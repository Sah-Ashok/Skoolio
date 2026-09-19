import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecureStorageService {
  static const _tokenKey = 'skoolio_auth_token';
  static const _userKey = 'skoolio_user_profile';
  static const _schoolKey = 'skoolio_school_info';
  static const _baseUrlKey = 'skoolio_base_url';

  final FlutterSecureStorage _secureStorage;
  final SharedPreferences _prefs;

  String? _cachedToken;
  Map<String, dynamic>? _cachedUser;

  SecureStorageService(this._secureStorage, this._prefs);

  static Future<SecureStorageService> init() async {
    const secureStorage = FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    );
    final prefs = await SharedPreferences.getInstance();
    final service = SecureStorageService(secureStorage, prefs);

    // Warm in-memory cache synchronously from SharedPreferences
    service._cachedToken = prefs.getString(_tokenKey);
    final rawUser = prefs.getString(_userKey);
    if (rawUser != null) {
      try {
        service._cachedUser = jsonDecode(rawUser) as Map<String, dynamic>;
      } catch (_) {}
    }

    // Try reading from secureStorage if prefs was empty
    if (service._cachedToken == null || service._cachedToken!.isEmpty) {
      try {
        final secToken = await secureStorage.read(key: _tokenKey);
        if (secToken != null && secToken.isNotEmpty) {
          service._cachedToken = secToken;
          await prefs.setString(_tokenKey, secToken);
        }
      } catch (_) {}
    }

    return service;
  }

  /// Fast synchronous token getter — 0ms latency, eliminates race conditions
  /// when multiple API requests fire simultaneously upon dashboard load.
  String? get tokenSync => _cachedToken ?? _prefs.getString(_tokenKey);

  // Token methods
  Future<void> saveToken(String token) async {
    _cachedToken = token;
    await _prefs.setString(_tokenKey, token);
    try {
      await _secureStorage.write(key: _tokenKey, value: token);
    } catch (_) {}
  }

  Future<String?> getToken() async {
    if (_cachedToken != null && _cachedToken!.isNotEmpty) {
      return _cachedToken;
    }
    final prefToken = _prefs.getString(_tokenKey);
    if (prefToken != null && prefToken.isNotEmpty) {
      _cachedToken = prefToken;
      return prefToken;
    }
    try {
      final t = await _secureStorage.read(key: _tokenKey);
      if (t != null && t.isNotEmpty) {
        _cachedToken = t;
        return t;
      }
    } catch (_) {}
    return null;
  }

  Future<void> clearToken() async {
    _cachedToken = null;
    await _prefs.remove(_tokenKey);
    try {
      await _secureStorage.delete(key: _tokenKey);
    } catch (_) {}
  }

  // User details
  Future<void> saveUser(Map<String, dynamic> userMap) async {
    _cachedUser = userMap;
    final encoded = jsonEncode(userMap);
    await _prefs.setString(_userKey, encoded);
    try {
      await _secureStorage.write(key: _userKey, value: encoded);
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getUser() async {
    if (_cachedUser != null) return _cachedUser;
    String? raw = _prefs.getString(_userKey);
    if (raw == null) {
      try {
        raw = await _secureStorage.read(key: _userKey);
      } catch (_) {}
    }
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      _cachedUser = decoded;
      return decoded;
    } catch (_) {
      return null;
    }
  }

  // School details
  Future<void> saveSchool(Map<String, dynamic> schoolMap) async {
    final encoded = jsonEncode(schoolMap);
    await _prefs.setString(_schoolKey, encoded);
    try {
      await _secureStorage.write(key: _schoolKey, value: encoded);
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getSchool() async {
    String? raw = _prefs.getString(_schoolKey);
    if (raw == null) {
      try {
        raw = await _secureStorage.read(key: _schoolKey);
      } catch (_) {}
    }
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // Base URL override (useful for testing on local network or changing production URLs)
  String? getBaseUrlOverride() {
    return _prefs.getString(_baseUrlKey);
  }

  Future<void> setBaseUrlOverride(String url) async {
    await _prefs.setString(_baseUrlKey, url);
  }

  // Quick session check — true if both token AND user profile are stored.
  Future<bool> hasSession() async {
    final token = await getToken();
    if (token == null || token.isEmpty) return false;
    final user = await getUser();
    return user != null;
  }

  // Clear all session data on logout
  Future<void> clearSession() async {
    _cachedToken = null;
    _cachedUser = null;
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_userKey);
    await _prefs.remove(_schoolKey);
    try {
      await _secureStorage.delete(key: _tokenKey);
      await _secureStorage.delete(key: _userKey);
      await _secureStorage.delete(key: _schoolKey);
    } catch (_) {}
  }
}
