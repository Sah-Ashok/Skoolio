import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic data;

  ApiException({required this.message, this.statusCode, this.data});

  @override
  String toString() => message;
}

class ApiClient {
  late final Dio _dio;
  final SecureStorageService _storage;
  void Function()? onUnauthorized;

  ApiClient(this._storage, {this.onUnauthorized}) {
    final baseUrl = _storage.getBaseUrlOverride() ?? ApiConstants.defaultBaseUrl;

    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = _storage.tokenSync ?? await _storage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
            options.headers['Cookie'] = 'token=$token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401) {
            final sentAuth = error.requestOptions.headers['Authorization']?.toString();
            // Only clear session if a valid Bearer token was actually sent and rejected by server
            if (sentAuth != null && sentAuth.startsWith('Bearer ')) {
              final currentToken = _storage.tokenSync ?? await _storage.getToken();
              if (currentToken != null && currentToken.isNotEmpty) {
                await _storage.clearSession();
                onUnauthorized?.call();
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Dio get dio => _dio;

  void updateBaseUrl(String newBaseUrl) {
    _dio.options.baseUrl = newBaseUrl;
    _storage.setBaseUrlOverride(newBaseUrl);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> post(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.post(path, data: data, queryParameters: queryParameters);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> put(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.put(path, data: data, queryParameters: queryParameters);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> patch(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.patch(path, data: data, queryParameters: queryParameters);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<dynamic> delete(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.delete(path, queryParameters: queryParameters);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  dynamic _handleResponse(Response response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      if (body.containsKey('success') && body['success'] == false) {
        throw ApiException(
          message: body['message']?.toString() ?? 'An error occurred',
          statusCode: response.statusCode,
          data: body,
        );
      }
      if (body.containsKey('data')) {
        return body['data'];
      }
    }
    return body;
  }

  ApiException _handleDioError(DioException e) {
    String message = 'Network connection error. Please try again.';
    int? code = e.response?.statusCode;

    if (e.response?.data is Map<String, dynamic>) {
      final data = e.response!.data as Map<String, dynamic>;
      if (data.containsKey('message')) {
        message = data['message'].toString();
      }
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      message = 'Connection timed out. Please check your internet connection.';
    } else if (e.type == DioExceptionType.connectionError) {
      message = 'Cannot connect to server. Please verify your network.';
    }

    return ApiException(message: message, statusCode: code, data: e.response?.data);
  }
}
