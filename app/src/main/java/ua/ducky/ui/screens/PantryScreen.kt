package ua.ducky.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.sp
import ua.ducky.ui.DuckyCard
import ua.ducky.ui.KeyValue
import ua.ducky.ui.Label
import ua.ducky.ui.ScreenScaffold
import ua.ducky.ui.theme.Ducky

@Composable
fun PantryScreen() = ScreenScaffold("Ставок запасів", "Що вдома сьогодні") {
    val c = Ducky.colors
    DuckyCard(gold = true) {
        Label("Скоро зіпсується")
        Text("[Продукт] · до [дата]", color = c.fg, fontSize = 20.sp, fontFamily = Ducky.serif)
    }
    // TODO: список з репозиторію продуктів; поки що макет
    repeat(4) {
        DuckyCard {
            Column {
                Text("[Продукт]", color = c.fg, fontSize = 22.sp, fontFamily = Ducky.serif)
                KeyValue("[магазин] · до [дата]", "[к-сть]")
            }
        }
    }
}
