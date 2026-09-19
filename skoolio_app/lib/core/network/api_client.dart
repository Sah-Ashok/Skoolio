import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
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

  ApiClient(this._storage) {
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

    // ── Allow self-signed / untrusted certificates ────────────────────────
    // The server runs on a raw IP (20.219.6.128). Flutter rejects self-signed
    // certs by default, which causes a HandshakeException that gets mistaken
    // for a 401 and wipes the session. This allows the connection to proceed.
    // In production, replace with a proper domain + valid TLS cert and remove this.
    (_dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
      final client = HttpClient();
      client.badCertificateCallback = (cert, host, port) => true;
      return client;
    };

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = _storage.tokenSync ?? await _storage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
            // Send Cookie header as well so backend cookie-parser recognizes it
            options.headers['Cookie'] = 'token=$token';
          }
          return handler.next(options);
        },
        onResponse: (response, handler) async {
          // Auto-capture token from Set-Cookie header if present
          final setCookies = response.headers['set-cookie'];
          if (setCookies != null) {
            for (final cookieStr in setCookies) {
              if (cookieStr.contains('token=')) {
                final match = RegExp(r'token=([^;]+)').firstMatch(cookieStr);
                if (match != null && match.group(1) != null) {
                  final captured = match.group(1)!.trim();
                  if (captured.isNotEmpty) {
                    await _storage.saveToken(captured);
                  }
                }
              }
            }
          }
          // Auto-capture token from response body if present
          if (response.data is Map) {
            final map = response.data as Map;
            String? bodyToken;
            if (map['token'] != null) {
              bodyToken = map['token'].toString();
            } else if (map['data'] is Map && (map['data'] as Map)['token'] != null) {
              bodyToken = (map['data'] as Map)['token'].toString();
            }
            if (bodyToken != null && bodyToken.isNotEmpty) {
              await _storage.saveToken(bodyToken);
            }
          }
          return handler.next(response);
        },
        onError: (DioException error, handler) async {
          final path = error.requestOptions.path;
          final isLoginPath = path.contains('/auth/login') || path.contains('/student-login');

          if (error.response?.statusCode == 401 && !isLoginPath) {
            // Guard: Only trigger force-logout if the request actually sent an Authorization
            // token that the server explicitly rejected as invalid or expired.
            // If the request was sent without a token due to a race condition, do NOT destroy the local session.
            final sentAuth = error.requestOptions.headers['Authorization']?.toString();
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
      // Skoolio API format: { success: true, message: "...", data: ... }
      if (body.containsKey('data')) {
        return body['data'];
      }
      return body;
    }
    return body;
  }

  ApiException _handleDioError(DioException error) {
    String message = 'An unexpected network error occurred. Please check your connection.';
    int? statusCode = error.response?.statusCode;

    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      message = 'Connection timed out. Please check your internet connection.';
    } else if (error.type == DioExceptionType.connectionError) {
      message = 'Unable to connect to school server. Please verify your server address.';
    } else if (error.type == DioExceptionType.badCertificate) {
      message = 'SSL certificate error. Please contact your school administrator.';
    } else if (error.response?.data != null) {
      final data = error.response?.data;
      if (data is Map<String, dynamic>) {
        message = data['message']?.toString() ?? data['error']?.toString() ?? message;
      }
    }

    return ApiException(message: message, statusCode: statusCode, data: error.response?.data);
  }
}

