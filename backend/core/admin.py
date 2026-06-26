from django.contrib import admin

from .models import Appointment, BarberShop, Client, Service, UserProfile


@admin.register(BarberShop)
class BarberShopAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "city", "status", "plan", "user", "suspended_at", "created_at")
    search_fields = ("name", "email", "city", "user__username")
    list_filter = ("status", "plan", "city", "created_at")
    readonly_fields = ("suspended_at", "reactivated_at", "suspended_by", "created_at", "updated_at")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Allows platform admins to be managed without changing Django's User admin."""

    list_display = ("user", "is_platform_admin", "created_at")
    search_fields = ("user__username", "user__email")
    list_filter = ("is_platform_admin", "created_at")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "barber_shop", "created_at")
    search_fields = ("name", "phone", "barber_shop__name")
    list_filter = ("barber_shop", "created_at")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "barber_shop", "created_at")
    search_fields = ("name", "barber_shop__name")
    list_filter = ("barber_shop", "created_at")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "client_name",
        "client_phone",
        "barber_shop",
        "date",
        "time",
        "status",
        "created_at",
    )
    search_fields = ("client_name", "client_phone", "barber_shop__name")
    list_filter = ("barber_shop", "status", "date", "created_at")
