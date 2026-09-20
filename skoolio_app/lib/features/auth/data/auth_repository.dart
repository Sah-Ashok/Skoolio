import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../domain/models.dart';

class AuthRepository {
  final ApiClient _apiClient;
  final SecureStorageService _storage;

  AuthRepository(this._apiClient, this._storage);

  String? _extractToken(dynamic response) {
    if (response is Map<String, dynamic>) {
      if (response['token'] != null) return response['token'].toString();
      if (response['data'] is Map<String, dynamic> && response['data']['token'] != null) {
        return response['data']['token'].toString();
      }
    }
    return null;
  }

  Map<String, dynamic> _extractUserMap(dynamic response) {
    if (response is Map<String, dynamic>) {
      if (response['user'] is Map<String, dynamic>) {
        return response['user'] as Map<String, dynamic>;
      }
      if (response['data'] is Map<String, dynamic>) {
        final data = response['data'] as Map<String, dynamic>;
        if (data['user'] is Map<String, dynamic>) {
          return data['user'] as Map<String, dynamic>;
        }
        return data;
      }
      return response;
    }
    throw ApiException(message: 'Invalid user response structure.');
  }

  Future<UserModel> loginStudent({
    required String identifier,
    required String password,
  }) async {
    final response = await _apiClient.post(
      ApiConstants.studentLogin,
      data: {
        'identifier': identifier.trim(),
        'password': password,
      },
    );

    final token = _extractToken(response);
    final userMap = _extractUserMap(response);

    if (token != null && token.isNotEmpty) {
      await _storage.saveToken(token);
    }
    await _storage.saveUser(userMap);

    return UserModel.fromJson(userMap);
  }

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

    final token = _extractToken(response);
    final userMap = _extractUserMap(response);

    if (token != null && token.isNotEmpty) {
      await _storage.saveToken(token);
    }
    await _storage.saveUser(userMap);

    return UserModel.fromJson(userMap);
  }

  Future<UserModel?> restoreSession() async {
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      return null;
    }

    final cachedUser = await _storage.getUser();
    if (cachedUser != null) {
      try {
        return UserModel.fromJson(cachedUser);
      } catch (_) {}
    }

    try {
      final response = await _apiClient.get(ApiConstants.getMe);
      final userMap = _extractUserMap(response);
      await _storage.saveUser(userMap);
      return UserModel.fromJson(userMap);
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.post(ApiConstants.logout);
    } catch (_) {}
    await _storage.clearSession();
  }
}
