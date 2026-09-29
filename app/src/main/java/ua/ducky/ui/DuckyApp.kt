package ua.ducky.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.ducky.ui.screens.MenuScreen
import ua.ducky.ui.screens.PantryScreen
import ua.ducky.ui.screens.RecipesScreen
import ua.ducky.ui.screens.ScanScreen
import ua.ducky.ui.screens.StoresScreen
import ua.ducky.ui.theme.Ducky

private enum class Tab(val label: String) {
    Pantry("Комора"), Scan("Чек"), Recipes("Рецепти"), Menu("Меню"), Stores("Ціни")
}

@Composable
fun DuckyApp() {
    val c = Ducky.colors
    var tab by remember { mutableStateOf(Tab.Pantry) }
    Column(Modifier.fillMaxSize().background(c.bg)) {
        Box(Modifier.weight(1f)) {
            when (tab) {
                Tab.Pantry -> PantryScreen()
                Tab.Scan -> ScanScreen()
                Tab.Recipes -> RecipesScreen()
                Tab.Menu -> MenuScreen()
                Tab.Stores -> StoresScreen()
            }
        }
        HorizontalDivider(color = c.line)
        Row(Modifier.fillMaxWidth().height(76.dp)) {
            Tab.entries.forEach { t ->
                val active = t == tab
                Text(
                    t.label,
                    color = if (active) c.gold else c.mute,
                    fontSize = 11.sp,
                    fontFamily = Ducky.sans,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f).clickable { tab = t }.padding(vertical = 28.dp),
                )
            }
        }
    }
}
