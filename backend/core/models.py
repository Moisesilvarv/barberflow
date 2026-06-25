from django.contrib.auth.models import User
from django.db import models


class BarberShop(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="barbershop",
    )
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128, blank=True)
    city = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


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
        constraints = [
            models.UniqueConstraint(
                fields=["barber_shop", "date", "time"],
                condition=~models.Q(status="canceled"),
                name="unique_active_appointment_per_slot",
            )
        ]
