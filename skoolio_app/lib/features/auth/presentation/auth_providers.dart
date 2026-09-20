import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../data/auth_repository.dart';
import '../domain/models.dart';

final Provider<SecureStorageService> storageServiceProvider = Provider<SecureStorageService>((ref) {
  throw UnimplementedError('storageServiceProvider must be overridden in ProviderScope');
});

final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(storageServiceProvider);
  return ApiClient(storage, onUnauthorized: () {
    ref.read(authStateProvider.notifier).handleUnauthorized();
  });
});

final Provider<AuthRepository> authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  final storage = ref.watch(storageServiceProvider);
  return AuthRepository(client, storage);
});

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

  AuthState copyWith({
    bool? isLoading,
    UserModel? user,
    String? errorMessage,
    bool? isInitialized,
    bool clearUser = false,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      user: clearUser ? null : (user ?? this.user),
      errorMessage: errorMessage,
      isInitialized: isInitialized ?? this.isInitialized,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repo;

  AuthNotifier(this._repo) : super(const AuthState()) {
    checkInitialSession();
  }

  Future<void> checkInitialSession() async {
    state = state.copyWith(isLoading: true);
    final user = await _repo.restoreSession();
    state = state.copyWith(
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
      final user = await _repo.loginStudent(identifier: identifier, password: password);
      state = state.copyWith(isLoading: false, user: user);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'An unexpected error occurred.');
      return false;
    }
  }

  Future<bool> loginTeacher({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final user = await _repo.loginTeacher(email: email, password: password);
      state = state.copyWith(isLoading: false, user: user);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'An unexpected error occurred.');
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true, clearUser: true);
    await _repo.logout();
    state = const AuthState(isInitialized: true);
  }

  void handleUnauthorized() {
    state = const AuthState(isInitialized: true);
  }

  void clearError() {
    state = state.copyWith(errorMessage: null);
  }
}

final StateNotifierProvider<AuthNotifier, AuthState> authStateProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return AuthNotifier(repo);
});
