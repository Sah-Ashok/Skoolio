import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../data/auth_repository.dart';
import '../domain/models.dart';

// Storage provider (overridden in main after async init)
final storageServiceProvider = Provider<SecureStorageService>((ref) {
  throw UnimplementedError('storageServiceProvider must be initialized');
});

// ApiClient provider
final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(storageServiceProvider);
  return ApiClient(storage);
});

// AuthRepository provider
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  final storage = ref.watch(storageServiceProvider);
  return AuthRepository(client, storage);
});

// Auth State
class AuthState {
  final bool isLoading;
  final UserModel? user;
  final String? errorMessage;
  final bool isInitialized;

  const AuthState({
    this.isLoading = false,
    this.user,
    this.errorMessage,
    this.isInitialized = false,
  });

  bool get isAuthenticated => user != null;

  // Sentinel so we can explicitly set user to null via copyWith.
  static const _absent = Object();

  AuthState copyWith({
    bool? isLoading,
    Object? user = _absent,
    String? errorMessage,
    bool? isInitialized,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      // If caller omitted user (sentinel kept), preserve existing value.
      // If caller passed null or a UserModel explicitly, use that.
      user: identical(user, _absent) ? this.user : user as UserModel?,
      errorMessage: errorMessage,
      isInitialized: isInitialized ?? this.isInitialized,
    );
  }
}

// Auth State Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repo;
  // Guard: ensures _checkInitialSession() runs exactly once per notifier
  // instance, never again on provider rebuild or widget re-watch.
  bool _sessionChecked = false;

  AuthNotifier(this._repo, Ref ref) : super(const AuthState()) {
    // Wire 401 responses → force-logout without a circular provider dependency.
    ref.read(apiClientProvider).onUnauthorized = () => handleUnauthorized();
    _checkInitialSession();
  }

  Future<void> _checkInitialSession() async {
    // Prevent double-execution if the notifier is somehow called again.
    if (_sessionChecked) return;
    _sessionChecked = true;

    state = state.copyWith(isLoading: true);
    final user = await _repo.restoreSession();
    // Always mark isInitialized=true so splash screen can navigate.
    state = AuthState(
      isLoading: false,
      user: user,
      isInitialized: true,
    );
  }

  Future<bool> loginStudent({
    required String identifier,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final user = await _repo.loginStudent(
        identifier: identifier,
        password: password,
      );
      state = AuthState(isLoading: false, user: user, isInitialized: true);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'An unexpected error occurred: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> loginTeacher({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final user = await _repo.loginTeacher(
        email: email,
        password: password,
      );
      state = AuthState(isLoading: false, user: user, isInitialized: true);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'An unexpected error occurred: ${e.toString()}',
      );
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await _repo.logout();
    // Reset to a clean unauthenticated state (user is explicitly null).
    state = const AuthState(isInitialized: true);
  }

  void handleUnauthorized() {
    state = const AuthState(isInitialized: true);
  }

  void clearError() {
    state = state.copyWith(errorMessage: null);
  }
}

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return AuthNotifier(repo, ref);
});
