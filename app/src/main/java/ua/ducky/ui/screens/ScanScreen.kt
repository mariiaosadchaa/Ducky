package ua.ducky.ui.screens

import androidx.compose.runtime.Composable
import ua.ducky.ui.DuckyCard
import ua.ducky.ui.GoldButton
import ua.ducky.ui.KeyValue
import ua.ducky.ui.Label
import ua.ducky.ui.ScreenScaffold

@Composable
fun ScanScreen() = ScreenScaffold("Скан чека", "Чек у комору") {
    DuckyCard(gold = true) {
        Label("Сфотографуйте чек або оберіть із галереї")
    }
    // TODO: камера/галерея + розпізнавання (OCR)
    DuckyCard {
        KeyValue("[магазин]", "[дата]")
        repeat(3) { KeyValue("[Продукт]", "[ціна] ₴") }
        KeyValue("Разом", "[сума] ₴")
    }
    GoldButton("Додати в комору")
}
