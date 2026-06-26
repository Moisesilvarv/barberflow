import logging

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Appointment, BarberShop


logger = logging.getLogger(__name__)

OPENING_HOUR = 9
CLOSING_HOUR = 18
SLOT_MINUTES = 30


def build_available_slots():
    slots = []
    for hour in range(OPENING_HOUR, CLOSING_HOUR):
        slots.append(f"{hour:02d}:00")
        slots.append(f"{hour:02d}:30")
    return slots


AVAILABLE_SLOTS = build_available_slots()


def validate_future_appointment_datetime(date, time):
    if not date or not time:
        return

    today = timezone.localdate()
    if date < today:
        raise serializers.ValidationError("Appointment date cannot be in the past.")

    if date == today and time <= timezone.localtime().time():
        raise serializers.ValidationError("Appointment time cannot be in the past.")


class BarberShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarberShop
        fields = ("id", "name", "email", "city", "created_at")
        read_only_fields = ("id", "email", "created_at")


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    name = serializers.CharField(max_length=120)
    city = serializers.CharField(max_length=100)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already in use.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists() or BarberShop.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        barber_shop = BarberShop.objects.create(
            user=user,
            name=validated_data["name"],
            email=validated_data["email"],
            city=validated_data["city"],
        )
        return {"user": user, "barber_shop": barber_shop}

    def to_representation(self, instance):
        user = instance["user"]
        barber_shop = instance["barber_shop"]
        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            "barber_shop": BarberShopSerializer(barber_shop).data,
        }


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")

        logger.info("Login attempt received for email=%s", email)

        users = list(User.objects.filter(email__iexact=email).order_by("id"))
        logger.info("Login lookup users_found=%s for email=%s", len(users), email)

        if not users:
            logger.warning("Login failed: user not found for email=%s", email)
            raise serializers.ValidationError("Invalid credentials.")

        active_users = [user for user in users if user.is_active]
        if not active_users:
            logger.warning("Login failed: inactive user for email=%s", email)
            raise serializers.ValidationError("Invalid credentials.")

        users_with_barber_shop = [
            user for user in active_users if hasattr(user, "barbershop")
        ]
        if not users_with_barber_shop:
            logger.warning("Login failed: user has no BarberShop for email=%s", email)
            raise serializers.ValidationError("Invalid credentials.")

        user = users_with_barber_shop[0]
        password_is_valid = user.check_password(password)
        logger.info(
            "Login password check for user_id=%s email=%s valid=%s",
            user.id,
            email,
            password_is_valid,
        )

        if not password_is_valid:
            logger.warning("Login failed: invalid password for user_id=%s email=%s", user.id, email)
            raise serializers.ValidationError("Invalid credentials.")

        refresh = RefreshToken.for_user(user)
        logger.info("Login success for user_id=%s email=%s", user.id, email)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "email": user.email,
            },
        }


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")
        read_only_fields = fields


class MeSerializer(serializers.Serializer):
    user = UserSerializer(read_only=True)
    barber_shop = BarberShopSerializer(read_only=True)


class AppointmentSerializer(serializers.ModelSerializer):
    barber_shop = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Appointment
        fields = (
            "id",
            "barber_shop",
            "client_name",
            "client_phone",
            "date",
            "time",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "barber_shop", "created_at")

    def validate_time(self, value):
        if value.strftime("%H:%M") not in AVAILABLE_SLOTS:
            raise serializers.ValidationError("Appointment time must be an available 30-minute slot.")
        return value

    def validate(self, attrs):
        barber_shop = self.context.get("barber_shop")
        date = attrs.get("date", getattr(self.instance, "date", None))
        time = attrs.get("time", getattr(self.instance, "time", None))

        if not barber_shop:
            raise serializers.ValidationError("Barber shop context is required.")

        validate_future_appointment_datetime(date, time)

        if date and time:
            appointments = Appointment.objects.filter(
                barber_shop=barber_shop,
                date=date,
                time=time,
            ).exclude(status=Appointment.Status.CANCELED)
            if self.instance:
                appointments = appointments.exclude(pk=self.instance.pk)
            if appointments.exists():
                raise serializers.ValidationError("This time slot is already booked.")

        return attrs


class PublicAppointmentSerializer(serializers.ModelSerializer):
    barber_shop_id = serializers.PrimaryKeyRelatedField(
        queryset=BarberShop.objects.all(),
        source="barber_shop",
        write_only=True,
    )

    class Meta:
        model = Appointment
        fields = (
            "id",
            "barber_shop_id",
            "client_name",
            "client_phone",
            "date",
            "time",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "status", "created_at")

    def validate_time(self, value):
        if value.strftime("%H:%M") not in AVAILABLE_SLOTS:
            raise serializers.ValidationError("Appointment time must be an available 30-minute slot.")
        return value

    def validate(self, attrs):
        barber_shop = attrs.get("barber_shop")
        date = attrs.get("date")
        time = attrs.get("time")

        validate_future_appointment_datetime(date, time)

        if barber_shop and date and time:
            if Appointment.objects.filter(
                barber_shop=barber_shop,
                date=date,
                time=time,
            ).exclude(status=Appointment.Status.CANCELED).exists():
                raise serializers.ValidationError("This time slot is already booked.")

        return attrs

    def create(self, validated_data):
        validated_data["status"] = Appointment.Status.PENDING
        return super().create(validated_data)
