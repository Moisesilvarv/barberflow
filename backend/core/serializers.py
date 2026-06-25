from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Appointment, BarberShop


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
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        username = attrs.get("username")
        password = attrs.get("password")

        if email and not username:
            user_by_email = (
                User.objects.filter(email=email, barbershop__isnull=False, is_active=True)
                .order_by("id")
                .first()
            )
            if not user_by_email:
                user_by_email = User.objects.filter(email=email, is_active=True).order_by("id").first()
            if user_by_email:
                username = user_by_email.username

        if not username:
            raise serializers.ValidationError("Username or email is required.")

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )
        if not user:
            raise serializers.ValidationError("Invalid credentials.")

        refresh = RefreshToken.for_user(user)
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
