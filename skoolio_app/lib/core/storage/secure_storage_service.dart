import 'dart:async';
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

  // In-memory synchronous cache for zero-latency access
  String? _cachedToken;

  SecureStorageService(this._secureStorage, this._prefs) {
    _cachedToken = _prefs.getString(_tokenKey);
  }

  static Future<SecureStorageService> init() async {
    const secureStorage = FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    );
    final prefs = await SharedPreferences.getInstance();
    return SecureStorageService(secureStorage, prefs);
  }

  // Synchronous token getter for requests
  String? get tokenSync => _cachedToken ?? _prefs.getString(_tokenKey);

  // Token methods
  Future<void> saveToken(String token) async {
    _cachedToken = token;
    await _prefs.setString(_tokenKey, token);
    // Background write to KeyStore to eliminate synchronous Keystore latency
    unawaited(_secureStorage.write(key: _tokenKey, value: token).catchError((_) {}));
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
      final secToken = await _secureStorage.read(key: _tokenKey);
      if (secToken != null) {
        _cachedToken = secToken;
        await _prefs.setString(_tokenKey, secToken);
      }
      return secToken;
    } catch (_) {
      return null;
    }
  }

  Future<void> clearToken() async {
    _cachedToken = null;
    await _prefs.remove(_tokenKey);
    unawaited(_secureStorage.delete(key: _tokenKey).catchError((_) {}));
  }

  // User details
  Future<void> saveUser(Map<String, dynamic> userMap) async {
    final str = jsonEncode(userMap);
    await _prefs.setString(_userKey, str);
    try {
      await _secureStorage.write(key: _userKey, value: str);
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getUser() async {
    final raw = _prefs.getString(_userKey);
    if (raw != null) {
      try {
        return jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {}
    }
    try {
      final secRaw = await _secureStorage.read(key: _userKey);
      if (secRaw == null) return null;
      return jsonDecode(secRaw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // Clear entire session
  Future<void> clearSession() async {
    _cachedToken = null;
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_userKey);
    await _prefs.remove(_schoolKey);
    try {
      await _secureStorage.deleteAll();
    } catch (_) {}
  }

  // Base URL override for dev/custom deployment
  String? getBaseUrlOverride() {
    return _prefs.getString(_baseUrlKey);
  }

  Future<void> setBaseUrlOverride(String url) async {
    await _prefs.setString(_baseUrlKey, url);
  }
}
