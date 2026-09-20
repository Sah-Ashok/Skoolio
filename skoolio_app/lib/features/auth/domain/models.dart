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
  final String? currency;
  final String? currencySymbol;

  // Student specific fields
  final String? admissionNumber;
  final String? rollNumber;
  final int? classId;
  final String? className;
  final int? sectionId;
  final String? sectionName;
  final String? dob;
  final String? gender;
  final String? bloodGroup;
  final String? parentName;
  final String? parentPhone;
  final String? address;

  // Teacher specific fields
  final String? employeeId;
  final String? status;
  final String? qualification;
  final String? specialization;
  final String? experience;
  final String? joiningDate;

  UserModel({
    required this.id,
    this.email,
    required this.fullName,
    required this.role,
    required this.schoolId,
    this.schoolName,
    this.schoolCode,
    this.logo,
    this.phone,
    this.currency,
    this.currencySymbol,
    this.admissionNumber,
    this.rollNumber,
    this.classId,
    this.className,
    this.sectionId,
    this.sectionName,
    this.dob,
    this.gender,
    this.bloodGroup,
    this.parentName,
    this.parentPhone,
    this.address,
    this.employeeId,
    this.status,
    this.qualification,
    this.specialization,
    this.experience,
    this.joiningDate,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final roleStr = json['role']?.toString() ?? 'student';
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      email: json['email']?.toString(),
      fullName: json['full_name']?.toString() ?? json['name']?.toString() ?? 'User',
      role: UserRole.fromString(roleStr),
      schoolId: json['school_id'] is int
          ? json['school_id']
          : int.tryParse(json['school_id']?.toString() ?? '0') ?? 0,
      schoolName: json['school_name']?.toString(),
      schoolCode: json['school_code']?.toString(),
      logo: json['logo']?.toString(),
      phone: json['phone']?.toString(),
      currency: json['currency']?.toString() ?? 'USD',
      currencySymbol: json['currency_symbol']?.toString() ?? '\$',
      // Student
      admissionNumber: json['admission_number']?.toString(),
      rollNumber: json['roll_number']?.toString() ?? json['roll_no']?.toString(),
      classId: json['class_id'] is int ? json['class_id'] : int.tryParse(json['class_id']?.toString() ?? ''),
      className: json['class_name']?.toString(),
      sectionId: json['section_id'] is int ? json['section_id'] : int.tryParse(json['section_id']?.toString() ?? ''),
      sectionName: json['section_name']?.toString(),
      dob: json['dob']?.toString() ?? json['date_of_birth']?.toString(),
      gender: json['gender']?.toString(),
      bloodGroup: json['blood_group']?.toString(),
      parentName: json['parent_name']?.toString() ?? json['father_name']?.toString() ?? json['guardian_name']?.toString(),
      parentPhone: json['parent_phone']?.toString() ?? json['guardian_phone']?.toString(),
      address: json['address']?.toString() ?? json['current_address']?.toString(),
      // Teacher
      employeeId: json['employee_id']?.toString() ?? json['teacher_code']?.toString(),
      status: json['status']?.toString() ?? 'active',
      qualification: json['qualification']?.toString(),
      specialization: json['specialization']?.toString(),
      experience: json['experience']?.toString(),
      joiningDate: json['joining_date']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': fullName,
      'role': role.name,
      'school_id': schoolId,
      'school_name': schoolName,
      'school_code': schoolCode,
      'logo': logo,
      'phone': phone,
      'currency': currency,
      'currency_symbol': currencySymbol,
      'admission_number': admissionNumber,
      'roll_number': rollNumber,
      'class_id': classId,
      'class_name': className,
      'section_id': sectionId,
      'section_name': sectionName,
      'dob': dob,
      'gender': gender,
      'blood_group': bloodGroup,
      'parent_name': parentName,
      'parent_phone': parentPhone,
      'address': address,
      'employee_id': employeeId,
      'status': status,
      'qualification': qualification,
      'specialization': specialization,
      'experience': experience,
      'joining_date': joiningDate,
    };
  }
}
