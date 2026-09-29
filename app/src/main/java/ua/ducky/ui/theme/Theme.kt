package ua.ducky.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily

/** Палітра «Нічне золото» з docs/design.md. */
data class DuckyColors(
    val bg: Color,
    val fg: Color,
    val mute: Color,
    val gold: Color,
    val line: Color,
    val card: Color,
    val btnBg: Color,
    val btnFg: Color,
)

val DarkColors = DuckyColors(
    bg = Color(0xFF0B1220), fg = Color(0xFFEFE6D2), mute = Color(0xFFA9A291),
    gold = Color(0xFFD9BF8C), line = Color(0xFF2A2F3D), card = Color(0xFF111A2C),
    btnBg = Color(0xFFD9BF8C), btnFg = Color(0xFF0B1220),
)

val LightColors = DuckyColors(
    bg = Color(0xFFF7F1E3), fg = Color(0xFF0B1220), mute = Color(0xFF55596A),
    gold = Color(0xFF7D5E25), line = Color(0xFFDDD2B8), card = Color(0xFFFFFAF0),
    btnBg = Color(0xFF0B1220), btnFg = Color(0xFFF7F1E3),
)

private val LocalDuckyColors = staticCompositionLocalOf { DarkColors }

object Ducky {
    val colors: DuckyColors
        @Composable @ReadOnlyComposable get() = LocalDuckyColors.current

    // TODO: підключити Cormorant Garamond та Jost через res/font
    val serif: FontFamily = FontFamily.Serif
    val sans: FontFamily = FontFamily.SansSerif
}

@Composable
fun DuckyTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val c = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(primary = c.gold, background = c.bg, surface = c.card, onBackground = c.fg, onSurface = c.fg)
    } else {
        lightColorScheme(primary = c.gold, background = c.bg, surface = c.card, onBackground = c.fg, onSurface = c.fg)
    }
    CompositionLocalProvider(LocalDuckyColors provides c) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
