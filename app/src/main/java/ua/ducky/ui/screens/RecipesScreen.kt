package ua.ducky.ui.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.sp
import ua.ducky.domain.Appliance
import ua.ducky.ui.DuckyCard
import ua.ducky.ui.KeyValue
import ua.ducky.ui.Label
import ua.ducky.ui.ScreenScaffold
import ua.ducky.ui.theme.Ducky

@Composable
fun RecipesScreen() = ScreenScaffold("Рецепти", "З того, що є вдома") {
    val c = Ducky.colors
    // TODO: підбір рецептів за коморою, технікою та вподобаннями
    Appliance.entries.forEach { a ->
        DuckyCard {
            Label(a.label)
            Text("[Назва страви]", color = c.fg, fontSize = 26.sp, fontFamily = Ducky.serif)
            KeyValue("[час] хв · [порцій] порції", "Докупити: [0–2]")
        }
    }
}
