package ua.ducky.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.sp
import ua.ducky.ui.DuckyCard
import ua.ducky.ui.KeyValue
import ua.ducky.ui.Label
import ua.ducky.ui.ScreenScaffold
import ua.ducky.ui.theme.Ducky

@Composable
fun MenuScreen() = ScreenScaffold("Меню на тиждень", "Сім днів без хаосу") {
    val c = Ducky.colors
    // TODO: генерація меню в межах тижневого бюджету
    listOf("Сніданок", "Обід", "Вечеря").forEach { meal ->
        DuckyCard {
            Label(meal)
            Text("[страва]", color = c.fg, fontSize = 24.sp, fontFamily = Ducky.serif)
        }
    }
    DuckyCard(gold = true) {
        Label("Список покупок")
        KeyValue("[сума] ₴", "з [бюджет] ₴")
    }
}
