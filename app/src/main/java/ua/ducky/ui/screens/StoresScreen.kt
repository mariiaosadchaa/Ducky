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
fun StoresScreen() = ScreenScaffold("Аналіз цін", "Де купувати вигідніше") {
    val c = Ducky.colors
    DuckyCard(gold = true) {
        Label("Можлива економія за тиждень")
        Text("[сума] ₴", color = c.gold, fontSize = 32.sp, fontFamily = Ducky.serif)
    }
    // TODO: порівняння за чеками; без даних цін не показуємо
    repeat(4) {
        DuckyCard {
            Text("[Категорія]", color = c.fg, fontSize = 22.sp, fontFamily = Ducky.serif)
            KeyValue("Сільпо · АТБ · Novus · Фора", "Вигідніше: [магазин]")
        }
    }
}
