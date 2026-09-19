import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../domain/models.dart';

class AuthRepository {
  final ApiClient _apiClient;
  final SecureStorageService _storage;

  AuthRepository(this._apiClient, this._storage);

  /// Extracts a flat user map from various Skoolio API response shapes.
  /// Handles:
  ///   { user: {...}, token: "..." }          — login responses
  ///   { user: {...} }                         — /me responses
  ///   { id, role, ... }                       — flat user directly in data
  /// Extracts a flat user map from various Skoolio API response shapes.
  /// Handles:
  ///   { user: {...}, token: "..." }          — login responses
  ///   { data: { user: {...}, token: "..." } } — wrapped login responses
  ///   { user: {...} }                         — /me responses
  ///   { id, role, ... }                       — flat user directly in data
  Map<String, dynamic> _extractUserMap(Map response) {
    if (response['user'] is Map) {
      return Map<String, dynamic>.from(response['user'] as Map);
    }
    if (response['data'] is Map && (response['data'] as Map)['user'] is Map) {
      return Map<String, dynamic>.from((response['data'] as Map)['user'] as Map);
    }
    // Flat user object directly (e.g. some /me endpoints)
    if (response.containsKey('id') && response.containsKey('role')) {
      return Map<String, dynamic>.from(response);
    }
    return Map<String, dynamic>.from(response);
  }

  /// Extracts token from various Skoolio API response formats
  String? _extractToken(Map response) {
    if (response['token'] != null && response['token'].toString().isNotEmpty) {
      return response['token'].toString();
    }
    if (response['data'] is Map && (response['data'] as Map)['token'] != null) {
      return (response['data'] as Map)['token'].toString();
    }
    return null;
  }

  /// Student / Parent login via admission number or email + password
  Future<UserModel> loginStudent({
    required String identifier,
    required String password,
  }) async {
    final response = await _apiClient.post(
      ApiConstants.studentLogin,
      data: {
        'email': identifier.trim(),
        'identifier': identifier.trim(),
        'password': password,
      },
    );

    if (response is! Map) {
      throw ApiException(message: 'Invalid response from server.');
    }

    final responseMap = Map<String, dynamic>.from(response);
    final token = _extractToken(responseMap);
    final userMap = _extractUserMap(responseMap);

    if (token != null && token.isNotEmpty) {
      await _storage.saveToken(token);
    }
    await _storage.saveUser(userMap);

    return UserModel.fromJson(userMap);
  }

  /// Teacher / Faculty login via email + password
  Future<UserModel> loginTeacher({
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.post(
      ApiConstants.teacherLogin,
      data: {
        'email': email.trim(),
        'password': password,
      },
    );

    if (response is! Map) {
      throw ApiException(message: 'Invalid response from server.');
    }

    final responseMap = Map<String, dynamic>.from(response);
    final token = _extractToken(responseMap);
    final userMap = _extractUserMap(responseMap);

    // Block admins — mobile app is for teachers and students only.
    final roleStr = userMap['role']?.toString().toLowerCase() ?? '';
    if (roleStr == 'admin' || roleStr == 'super_admin') {
      await _storage.clearSession();
      throw ApiException(
        message:
            'School Administrators must use the Web Portal. '
            'This mobile app is for Teachers and Students only.',
      );
    }

    if (token != null && token.isNotEmpty) {
      await _storage.saveToken(token);
    }
    await _storage.saveUser(userMap);

    return UserModel.fromJson(userMap);
  }

  /// Restore session on app start.
  ///
  /// Strategy — offline-first, never clear on network errors:
  ///   1. No token stored → not logged in.
  ///   2. Token + cached user stored → return cached user immediately.
  ///      No network call is made. The JWT itself encodes the expiry (10d)
  ///      so the token is the source of truth; the /me payload never changes
  ///      between logins (name, role, school_id are stable).
  ///   3. Token stored but no cached user (edge case) → try /me once.
  ///      Only a hard 401 clears the session; every other error keeps it.
  ///
  /// Session is ONLY cleared on:
  ///   • Explicit logout()
  ///   • A confirmed 401 from the server (token rejected / expired)
  ///   • The 401 interceptor in ApiClient.onUnauthorized
  Future<UserModel?> restoreSession() async {
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) return null;

    // ── Fast path: return the user we already stored at login time ──────────
    // The /me data does not change between logins (role, school_id, name are
    // stable), so there is no reason to hit the network on every app start.
    final cachedUser = await _storage.getUser();
    if (cachedUser != null) {
      // Safety: block admins even from cached data.
      final roleStr = cachedUser['role']?.toString().toLowerCase() ?? '';
      if (roleStr == 'admin' || roleStr == 'super_admin') {
        await _storage.clearSession();
        return null;
      }
      return UserModel.fromJson(cachedUser);
    }

    // ── Slow path: token exists but no cached user (first install edge case)
    // Try one /me call. Only a 401 clears the session.
    try {
      final response = await _apiClient.get(ApiConstants.getMe);

      if (response is! Map<String, dynamic>) {
        // Malformed response — keep the token, return null (will retry next launch).
        return null;
      }

      final userMap = _extractUserMap(response);

      final roleStr = userMap['role']?.toString().toLowerCase() ?? '';
      if (roleStr == 'admin' || roleStr == 'super_admin') {
        await _storage.clearSession();
        return null;
      }

      await _storage.saveUser(userMap);
      return UserModel.fromJson(userMap);
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        // Token definitively rejected by the server — clear everything.
        await _storage.clearSession();
        return null;
      }
      // Network error, 500, timeout, SSL issue, etc.
      // Do NOT clear the session. The token is still valid; the server
      // was just unreachable. The user stays logged in.
      return null;
    } catch (_) {
      // JSON parse error or anything unexpected.
      // Still do NOT clear. Return null — next app start will retry.
      return null;
    }
  }

  /// Logout and purge local credentials.
  Future<void> logout() async {
    try {
      await _apiClient.post(ApiConstants.logout);
    } catch (_) {
      // Best-effort server logout — always clear local session.
    }
    await _storage.clearSession();
  }
}
