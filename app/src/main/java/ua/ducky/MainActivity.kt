package ua.ducky

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import ua.ducky.ui.DuckyApp
import ua.ducky.ui.theme.DuckyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { DuckyTheme { DuckyApp() } }
    }
}
