import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';

enum AppLoaderSize { sm, md, lg }

/// Branded Skoolio Loader featuring the animated smile logo in the center of a spinning ring,
/// with an optional text label and bouncing dots, matching Next.js Web Loader behavior.
class AppLoader extends StatefulWidget {
  final String? text;
  final bool fullScreen;
  final AppLoaderSize size;

  const AppLoader({
    super.key,
    this.text = 'Loading...',
    this.fullScreen = false,
    this.size = AppLoaderSize.lg,
  });

  /// Full-screen backdrop overlay for blocking operations
  static Widget overlay({String text = 'Please wait...'}) {
    return AppLoader(
      text: text,
      fullScreen: true,
      size: AppLoaderSize.lg,
    );
  }

  /// Compact inline spinner for buttons
  static Widget spinner({double size = 18, Color color = const Color(0xFFFF9B51)}) {
    return _MiniSpinner(size: size, color: color);
  }

  @override
  State<AppLoader> createState() => _AppLoaderState();
}

class _AppLoaderState extends State<AppLoader> with TickerProviderStateMixin {
  late final AnimationController _ringController;
  late final AnimationController _pulseController;
  late final AnimationController _bounceController;

  @override
  void initState() {
    super.initState();
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    _bounceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _ringController.dispose();
    _pulseController.dispose();
    _bounceController.dispose();
    super.dispose();
  }

  double get _outerSize {
    switch (widget.size) {
      case AppLoaderSize.sm:
        return 48;
      case AppLoaderSize.md:
        return 68;
      case AppLoaderSize.lg:
        return 86;
    }
  }

  double get _smileSize {
    switch (widget.size) {
      case AppLoaderSize.sm:
        return 26;
      case AppLoaderSize.md:
        return 38;
      case AppLoaderSize.lg:
        return 48;
    }
  }

  double get _strokeWidth => widget.size == AppLoaderSize.sm ? 2.5 : 3.5;

  @override
  Widget build(BuildContext context) {
    final scaleAnimation = Tween<double>(begin: 1.0, end: 1.07).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Ring & Pulsing Smile Logo
        SizedBox(
          width: _outerSize,
          height: _outerSize,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Spinning Gradient Arc Ring
              AnimatedBuilder(
                animation: _ringController,
                builder: (context, child) {
                  return RepaintBoundary(
                    child: CustomPaint(
                      size: Size(_outerSize, _outerSize),
                      painter: _RingArcPainter(
                        progress: _ringController.value,
                        strokeWidth: _strokeWidth,
                      ),
                    ),
                  );
                },
              ),
              // Center Pulsing Smile Logo
              ScaleTransition(
                scale: scaleAnimation,
                child: SizedBox(
                  width: _smileSize,
                  height: _smileSize,
                  child: Image.asset(
                    'assets/smile.png',
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) {
                      // Graceful fallback icon if image asset is unavailable
                      return const Icon(
                        Icons.sentiment_very_satisfied_rounded,
                        color: Color(0xFFFF9B51),
                        size: 32,
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
        if (widget.text != null && widget.text!.isNotEmpty) ...[
          SizedBox(height: widget.size == AppLoaderSize.sm ? 10 : 16),
          Text(
            widget.text!,
            style: TextStyle(
              fontSize: widget.size == AppLoaderSize.sm ? 12 : 13.5,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF475569),
              letterSpacing: 0.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          // 3 Bouncing Dots
          _BouncingDots(controller: _bounceController),
        ],
      ],
    );

    if (widget.fullScreen) {
      return Container(
        color: Colors.black.withValues(alpha: 0.3),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    color: Color.fromRGBO(0, 0, 0, 0.08),
                    blurRadius: 24,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: content,
            ),
          ),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: content,
      ),
    );
  }
}

class _RingArcPainter extends CustomPainter {
  final double progress;
  final double strokeWidth;

  _RingArcPainter({required this.progress, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Background track
    final trackPaint = Paint()
      ..color = const Color.fromRGBO(255, 155, 81, 0.14)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    canvas.drawCircle(center, radius, trackPaint);

    // Active spinning arc
    final startAngle = progress * 2 * math.pi;
    final sweepAngle = math.pi * 0.75; // 135 degree arc

    final rect = Rect.fromCircle(center: center, radius: radius);
    final arcPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        colors: const [Color(0xFFFF9B51), Color(0xFFFF781F)],
        transform: GradientRotation(startAngle),
      ).createShader(rect);

    canvas.drawArc(
      rect,
      startAngle,
      sweepAngle,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _RingArcPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.strokeWidth != strokeWidth;
  }
}

class _BouncingDots extends StatelessWidget {
  final AnimationController controller;

  const _BouncingDots({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        final delay = index * 0.2;
        return AnimatedBuilder(
          animation: controller,
          builder: (context, child) {
            double value = (controller.value - delay) % 1.0;
            if (value < 0) value += 1.0;
            
            // Peak bounce at value == 0.4
            double dy = 0.0;
            double opacity = 0.35;
            if (value <= 0.4) {
              final t = value / 0.4;
              dy = -5.0 * math.sin(t * math.pi);
              opacity = 0.35 + 0.65 * math.sin(t * math.pi);
            }

            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 2.5),
              child: Transform.translate(
                offset: Offset(0, dy),
                child: Opacity(
                  opacity: opacity,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFF9B51),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            );
          },
        );
      }),
    );
  }
}

class _MiniSpinner extends StatefulWidget {
  final double size;
  final Color color;

  const _MiniSpinner({required this.size, required this.color});

  @override
  State<_MiniSpinner> createState() => _MiniSpinnerState();
}

class _MiniSpinnerState extends State<_MiniSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return CustomPaint(
            painter: _MiniSpinnerPainter(
              progress: _controller.value,
              color: widget.color,
            ),
          );
        },
      ),
    );
  }
}

class _MiniSpinnerPainter extends CustomPainter {
  final double progress;
  final Color color;

  _MiniSpinnerPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final strokeWidth = 2.5;
    final radius = (size.width - strokeWidth) / 2;

    // Track
    final trackPaint = Paint()
      ..color = color.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    canvas.drawCircle(center, radius, trackPaint);

    // Arc
    final startAngle = progress * 2 * math.pi;
    final arcPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      math.pi * 0.6,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _MiniSpinnerPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.color != color;
  }
}
