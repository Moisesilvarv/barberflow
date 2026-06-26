import logging
import re

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Appointment, BarberShop
from .permissions import SUSPENDED_BARBERSHOP_MESSAGE, is_platform_admin_user


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

REQUIRED_MESSAGE = "Este campo e obrigatorio."
BLANK_MESSAGE = "Este campo nao pode ficar em branco."
INVALID_MESSAGE = "Informe um valor valido."


def validate_future_appointment_datetime(date, time):
    if not date or not time:
        return

    today = timezone.localdate()
    if date < today:
        raise serializers.ValidationError("A data do agendamento nao pode estar no passado.")

    if date == today and time <= timezone.localtime().time():
        raise serializers.ValidationError("O horario do agendamento nao pode estar no passado.")


def validate_phone_number(value):
    digits = re.sub(r"\D", "", value or "")
    if len(digits) not in {10, 11}:
        raise serializers.ValidationError("Telefone invalido.")
    if len(digits) > 13:
        raise serializers.ValidationError("Telefone invalido.")
    return value


class BarberShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarberShop
        fields = ("id", "name", "email", "city", "status", "created_at")
        read_only_fields = ("id", "email", "status", "created_at")


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})
    email = serializers.EmailField(error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE, "invalid": "Informe um e-mail valido."})
    password = serializers.CharField(write_only=True, min_length=8, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE, "min_length": "A senha deve ter pelo menos 8 caracteres."})
    name = serializers.CharField(max_length=120, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})
    city = serializers.CharField(max_length=100, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Este usuario ja esta em uso.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists() or BarberShop.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este e-mail ja esta em uso.")
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
    email = serializers.EmailField(error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE, "invalid": "Informe um e-mail valido."})
    password = serializers.CharField(write_only=True, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")

        logger.debug("Login attempt received for email=%s", email)

        users = list(User.objects.filter(email__iexact=email).order_by("id"))
        logger.debug("Login lookup users_found=%s for email=%s", len(users), email)

        if not users:
            logger.warning("Login failed: user not found for email=%s", email)
            raise serializers.ValidationError("Email ou senha invalidos.")

        active_users = [user for user in users if user.is_active]
        if not active_users:
            logger.warning("Login failed: inactive user for email=%s", email)
            raise serializers.ValidationError("Email ou senha invalidos.")

        platform_admins = [user for user in active_users if is_platform_admin_user(user)]
        users_with_barber_shop = [user for user in active_users if hasattr(user, "barbershop")]

        if platform_admins and not users_with_barber_shop:
            user = platform_admins[0]
            if not user.check_password(password):
                logger.warning("Login failed: invalid password for platform admin user_id=%s email=%s", user.id, email)
                raise serializers.ValidationError("Email ou senha invalidos.")
            refresh = RefreshToken.for_user(user)
            logger.debug("Platform admin login success for user_id=%s email=%s", user.id, email)
            return {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "email": user.email,
                },
            }

        if not users_with_barber_shop:
            logger.warning("Login failed: user has no BarberShop for email=%s", email)
            raise serializers.ValidationError("Email ou senha invalidos.")

        user = users_with_barber_shop[0]
        if not user.check_password(password):
            logger.warning("Login failed: invalid password for user_id=%s email=%s", user.id, email)
            raise serializers.ValidationError("Email ou senha invalidos.")
        if not is_platform_admin_user(user) and user.barbershop.status == BarberShop.Status.SUSPENDED:
            logger.warning("Login blocked: suspended BarberShop for user_id=%s email=%s", user.id, email)
            raise serializers.ValidationError(SUSPENDED_BARBERSHOP_MESSAGE)

        refresh = RefreshToken.for_user(user)
        logger.debug("Login success for user_id=%s email=%s", user.id, email)
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
    client_name = serializers.CharField(max_length=120, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})
    client_phone = serializers.CharField(max_length=20, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})
    date = serializers.DateField(error_messages={"required": REQUIRED_MESSAGE, "invalid": "Informe uma data valida."})
    time = serializers.TimeField(error_messages={"required": REQUIRED_MESSAGE, "invalid": "Informe um horario valido."})

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
            raise serializers.ValidationError("Escolha um horario valido de atendimento.")
        return value

    def validate_client_phone(self, value):
        return validate_phone_number(value)

    def validate(self, attrs):
        barber_shop = self.context.get("barber_shop")
        date = attrs.get("date", getattr(self.instance, "date", None))
        time = attrs.get("time", getattr(self.instance, "time", None))

        if not barber_shop:
            raise serializers.ValidationError("Nao foi possivel identificar a barbearia.")

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
                raise serializers.ValidationError("Ja existe um agendamento para este horario.")

        return attrs


class PublicAppointmentSerializer(serializers.ModelSerializer):
    barber_shop_id = serializers.PrimaryKeyRelatedField(
        queryset=BarberShop.objects.all(),
        source="barber_shop",
        write_only=True,
    )
    client_name = serializers.CharField(max_length=120, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})
    client_phone = serializers.CharField(max_length=20, error_messages={"required": REQUIRED_MESSAGE, "blank": BLANK_MESSAGE})
    date = serializers.DateField(error_messages={"required": REQUIRED_MESSAGE, "invalid": "Informe uma data valida."})
    time = serializers.TimeField(error_messages={"required": REQUIRED_MESSAGE, "invalid": "Informe um horario valido."})

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
            raise serializers.ValidationError("Escolha um horario valido de atendimento.")
        return value

    def validate_client_phone(self, value):
        return validate_phone_number(value)

    def validate(self, attrs):
        barber_shop = attrs.get("barber_shop")
        date = attrs.get("date")
        time = attrs.get("time")

        validate_future_appointment_datetime(date, time)

        if barber_shop and date and time:
            if barber_shop.status == BarberShop.Status.SUSPENDED:
                raise serializers.ValidationError("Esta barbearia esta temporariamente indisponivel.")
            if Appointment.objects.filter(
                barber_shop=barber_shop,
                date=date,
                time=time,
            ).exclude(status=Appointment.Status.CANCELED).exists():
                raise serializers.ValidationError("Ja existe um agendamento para este horario.")

        return attrs

    def create(self, validated_data):
        validated_data["status"] = Appointment.Status.PENDING
        return super().create(validated_data)
