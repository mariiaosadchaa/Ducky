package ua.ducky.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.ducky.ui.theme.Ducky

/** Каркас екрана: золотий підзаголовок, великий заголовок, вміст. */
@Composable
fun ScreenScaffold(eyebrow: String, title: String, content: @Composable () -> Unit) {
    val c = Ducky.colors
    Column(
        Modifier.fillMaxSize().background(c.bg).verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(eyebrow.uppercase(), color = c.gold, fontSize = 11.sp, letterSpacing = 3.sp, fontFamily = Ducky.sans)
        Text(title, color = c.fg, fontSize = 40.sp, lineHeight = 42.sp, fontFamily = Ducky.serif)
        content()
    }
}

@Composable
fun DuckyCard(gold: Boolean = false, content: @Composable () -> Unit) {
    val c = Ducky.colors
    val border = BorderStroke(1.dp, if (gold) c.gold else c.line)
    Column(
        Modifier.fillMaxWidth()
            .background(if (gold) Color.Transparent else c.card)
            .border(border)
            .padding(horizontal = 18.dp, vertical = 14.dp),
    ) { content() }
}

@Composable
fun Label(text: String) {
    val c = Ducky.colors
    Text(text.uppercase(), color = c.mute, fontSize = 11.sp, letterSpacing = 2.sp, fontFamily = Ducky.sans)
}

@Composable
fun KeyValue(key: String, value: String) {
    val c = Ducky.colors
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(key, color = c.mute, fontSize = 14.sp, fontFamily = Ducky.sans)
        Text(value, color = c.fg, fontSize = 14.sp, fontFamily = Ducky.sans)
    }
}

@Composable
fun GoldButton(text: String) {
    val c = Ducky.colors
    Text(
        text.uppercase(),
        color = c.btnFg, fontSize = 12.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Medium,
        fontFamily = Ducky.sans,
        modifier = Modifier.fillMaxWidth().background(c.btnBg).padding(16.dp),
    )
}
