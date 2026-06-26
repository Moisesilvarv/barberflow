from django.contrib.auth.models import User
from django.db import models


class BarberShop(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    class Plan(models.TextChoices):
        FREE = "free", "Free"
        BASIC = "basic", "Basic"
        PREMIUM = "premium", "Premium"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="barbershop",
    )
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128, blank=True)
    city = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    # Informational platform plan used by the future SaaS admin panel.
    plan = models.CharField(
        max_length=20,
        choices=Plan.choices,
        default=Plan.FREE,
    )
    # Simple suspension audit fields for the future platform admin panel.
    suspended_at = models.DateTimeField(null=True, blank=True)
    reactivated_at = models.DateTimeField(null=True, blank=True)
    suspended_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="suspended_barbershops",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    """Stores platform-level flags without replacing Django's built-in User model."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    is_platform_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        role = "Platform admin" if self.is_platform_admin else "User"
        return f"{self.user.email or self.user.username} - {role}"


class Client(models.Model):
    barber_shop = models.ForeignKey(
        BarberShop,
        on_delete=models.CASCADE,
        related_name="clients",
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Service(models.Model):
    barber_shop = models.ForeignKey(
        BarberShop,
        on_delete=models.CASCADE,
        related_name="services",
    )
    name = models.CharField(max_length=120)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELED = "canceled", "Canceled"

    barber_shop = models.ForeignKey(
        BarberShop,
        on_delete=models.CASCADE,
        related_name="appointments",
    )
    client_name = models.CharField(max_length=120)
    client_phone = models.CharField(max_length=20)
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.client_name} - {self.date} {self.time}"

    class Meta:
        indexes = [
            models.Index(fields=["barber_shop", "date", "time"], name="appt_shop_date_time_idx"),
            models.Index(fields=["barber_shop", "status"], name="appt_shop_status_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["barber_shop", "date", "time"],
                condition=~models.Q(status="canceled"),
                name="unique_active_appointment_per_slot",
            )
        ]
