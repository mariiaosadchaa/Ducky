package ua.ducky.domain

import java.time.LocalDate

/** Продукт у коморі. Дані беруться лише від користувача або з чеків. */
data class Product(
    val name: String,
    val quantity: String,
    val store: String? = null,
    val price: Double? = null,
    val boughtOn: LocalDate? = null,
    val bestBefore: LocalDate? = null,
)

data class Receipt(
    val store: String,
    val date: LocalDate,
    val items: List<Product>,
) {
    val total: Double get() = items.sumOf { it.price ?: 0.0 }
}

enum class Appliance(val label: String) {
    MULTICOOKER("Мультиварка"),
    OVEN("Духовка"),
    BREAD_MAKER("Хлібопічка"),
}

data class Recipe(
    val title: String,
    val appliance: Appliance?,
    val minutes: Int,
    val servings: Int,
    val have: List<String>,
    val toBuy: List<String>,
    val estimatedCost: Double?,
)
