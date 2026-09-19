enum UserRole {
  student,
  faculty;

  static UserRole fromString(String role) {
    if (role.toLowerCase() == 'student') return UserRole.student;
    return UserRole.faculty;
  }

  String get displayName {
    switch (this) {
      case UserRole.student:
        return 'Student / Parent';
      case UserRole.faculty:
        return 'Teacher';
    }
  }
}

// Lightweight subject/section references carried on the UserModel after login.
class UserSubject {
  final int id;
  final String name;
  final String? code;
  const UserSubject({required this.id, required this.name, this.code});

  factory UserSubject.fromJson(Map<String, dynamic> j) => UserSubject(
        id: _toInt(j['id']),
        name: j['name']?.toString() ?? j['subject_name']?.toString() ?? '',
        code: j['code']?.toString(),
      );
}

class UserSection {
  final int id;
  final String name;
  final String? className;
  const UserSection({required this.id, required this.name, this.className});

  factory UserSection.fromJson(Map<String, dynamic> j) => UserSection(
        id: _toInt(j['id']),
        name: j['name']?.toString() ?? '',
        className: j['class_name']?.toString(),
      );
}

class UserModel {
  final int id;
  final String? email;
  final String fullName;
  final UserRole role;
  final int schoolId;
  final String? schoolName;
  final String? schoolCode;
  final String? logo;
  final String? phone;
  // Student fields
  final String? admissionNumber;
  final String? className;
  final String? sectionName;
  // Teacher fields
  final String? gender;
  final String? employeeId;
  final String? status;       // 'active' | 'inactive' etc.
  final List<UserSubject> subjects;
  final List<UserSection> sections;
  // Shared finance fields
  final String? currency;
  final String? currencySymbol;
  final String? country;
  final String? calendarSystem; // 'AD' | 'BS'

  const UserModel({
    required this.id,
    this.email,
    required this.fullName,
    required this.role,
    required this.schoolId,
    this.schoolName,
    this.schoolCode,
    this.logo,
    this.phone,
    this.admissionNumber,
    this.className,
    this.sectionName,
    this.gender,
    this.employeeId,
    this.status,
    this.subjects = const [],
    this.sections = const [],
    this.currency,
    this.currencySymbol,
    this.country,
    this.calendarSystem,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final roleStr = json['role']?.toString() ?? 'student';

    // Parse subjects list — may be null or absent on student logins
    final rawSubjects = json['subjects'];
    final List<UserSubject> subjects = (rawSubjects is List)
        ? rawSubjects
            .whereType<Map>()
            .map((e) => UserSubject.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : const [];

    // Parse sections list
    final rawSections = json['sections'];
    final List<UserSection> sections = (rawSections is List)
        ? rawSections
            .whereType<Map>()
            .map((e) => UserSection.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : const [];

    return UserModel(
      id: _toInt(json['id']),
      email: json['email']?.toString(),
      fullName: json['full_name']?.toString() ??
          json['name']?.toString() ??
          'User',
      role: UserRole.fromString(roleStr),
      schoolId: _toInt(json['school_id']),
      schoolName: json['school_name']?.toString(),
      schoolCode: json['school_code']?.toString(),
      logo: json['logo']?.toString(),
      phone: json['phone']?.toString(),
      admissionNumber: json['admission_number']?.toString(),
      className: json['class_name']?.toString(),
      sectionName: json['section_name']?.toString(),
      gender: json['gender']?.toString(),
      employeeId: json['employee_id']?.toString(),
      status: json['status']?.toString(),
      subjects: subjects,
      sections: sections,
      currency: json['currency']?.toString() ?? 'USD',
      currencySymbol: json['currency_symbol']?.toString() ?? '\$',
      country: json['country']?.toString(),
      calendarSystem: json['calendar_system']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'full_name': fullName,
        'role': role.name,
        'school_id': schoolId,
        'school_name': schoolName,
        'school_code': schoolCode,
        'logo': logo,
        'phone': phone,
        'admission_number': admissionNumber,
        'class_name': className,
        'section_name': sectionName,
        'gender': gender,
        'employee_id': employeeId,
        'status': status,
        'subjects': subjects
            .map((s) => {'id': s.id, 'name': s.name, 'code': s.code})
            .toList(),
        'sections': sections
            .map((s) =>
                {'id': s.id, 'name': s.name, 'class_name': s.className})
            .toList(),
        'currency': currency,
        'currency_symbol': currencySymbol,
        'country': country,
        'calendar_system': calendarSystem,
      };

  /// Honorific used in teacher greeting (matches web portal logic).
  String get honorific {
    final g = (gender ?? '').trim().toLowerCase();
    if (g == 'male') return 'Sir';
    if (g == 'female') return "Ma'am";
    return 'Teacher';
  }
}

int _toInt(dynamic v) =>
    v is int ? v : int.tryParse(v?.toString() ?? '0') ?? 0;
