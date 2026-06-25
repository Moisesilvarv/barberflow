from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Appointment, BarberShop


class HealthCheckTests(APITestCase):
    def test_health_check_returns_ok(self):
        response = self.client.get(reverse("health-check"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "message": "BarberFlow API is running",
            },
        )


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.register_payload = {
            "username": "barber",
            "email": "barber@example.com",
            "password": "strong-pass-123",
            "name": "BarberFlow Shop",
            "city": "Sao Paulo",
        }

    def test_register_creates_user_and_barber_shop(self):
        response = self.client.post(reverse("register"), self.register_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["email"], self.register_payload["email"])
        self.assertEqual(response.data["barber_shop"]["name"], self.register_payload["name"])
        self.assertTrue(BarberShop.objects.filter(email=self.register_payload["email"]).exists())

    def test_login_returns_jwt_tokens_and_user(self):
        self.client.post(reverse("register"), self.register_payload, format="json")

        response = self.client.post(
            reverse("login"),
            {
                "email": self.register_payload["email"],
                "password": self.register_payload["password"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.register_payload["email"])

    def test_me_requires_authentication_and_returns_user_barber_shop(self):
        self.client.post(reverse("register"), self.register_payload, format="json")
        login_response = self.client.post(
            reverse("login"),
            {
                "username": self.register_payload["username"],
                "password": self.register_payload["password"],
            },
            format="json",
        )

        unauthenticated_response = self.client.get(reverse("me"))
        self.assertEqual(unauthenticated_response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        response = self.client.get(reverse("me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["email"], self.register_payload["email"])
        self.assertEqual(response.data["barber_shop"]["name"], self.register_payload["name"])

    def test_logout_blacklists_refresh_token(self):
        self.client.post(reverse("register"), self.register_payload, format="json")
        login_response = self.client.post(
            reverse("login"),
            {
                "username": self.register_payload["username"],
                "password": self.register_payload["password"],
            },
            format="json",
        )
        refresh = login_response.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        logout_response = self.client.post(reverse("logout"), {"refresh": refresh}, format="json")
        refresh_response = self.client.post(reverse("token-refresh"), {"refresh": refresh}, format="json")

        self.assertEqual(logout_response.status_code, status.HTTP_205_RESET_CONTENT)
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)


class AppointmentApiTests(APITestCase):
    def register_and_authenticate(self, username, email):
        payload = {
            "username": username,
            "email": email,
            "password": "strong-pass-123",
            "name": f"{username} Shop",
            "city": "Sao Paulo",
        }
        self.client.post(reverse("register"), payload, format="json")
        login_response = self.client.post(
            reverse("login"),
            {
                "username": username,
                "password": payload["password"],
            },
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        return BarberShop.objects.get(email=email)

    def test_private_appointments_require_authentication(self):
        response = self.client.get(reverse("appointment-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_and_list_appointments_only_for_authenticated_barber_shop(self):
        first_shop = self.register_and_authenticate("first", "first@example.com")
        create_response = self.client.post(
            reverse("appointment-list"),
            {
                "client_name": "Maria",
                "client_phone": "11999999999",
                "date": "2026-07-01",
                "time": "09:00",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["barber_shop"], first_shop.id)

        self.client.credentials()
        second_shop = self.register_and_authenticate("second", "second@example.com")
        Appointment.objects.create(
            barber_shop=second_shop,
            client_name="Joao",
            client_phone="11888888888",
            date="2026-07-01",
            time="10:00",
        )

        list_response = self.client.get(reverse("appointment-list"))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["client_name"], "Joao")

    def test_appointment_conflict_is_blocked_per_barber_shop(self):
        self.register_and_authenticate("barber", "barber-conflict@example.com")
        payload = {
            "client_name": "Maria",
            "client_phone": "11999999999",
            "date": "2026-07-02",
            "time": "09:30",
        }

        first_response = self.client.post(reverse("appointment-list"), payload, format="json")
        conflict_response = self.client.post(reverse("appointment-list"), payload, format="json")

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(conflict_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_appointment_required_fields_are_validated(self):
        self.register_and_authenticate("required", "required@example.com")

        response = self.client.post(reverse("appointment-list"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("client_name", response.data)
        self.assertIn("client_phone", response.data)
        self.assertIn("date", response.data)
        self.assertIn("time", response.data)

    def test_detail_patch_and_delete_are_scoped_to_owner(self):
        first_shop = self.register_and_authenticate("owner", "owner@example.com")
        appointment = Appointment.objects.create(
            barber_shop=first_shop,
            client_name="Maria",
            client_phone="11999999999",
            date="2026-07-03",
            time="11:00",
        )

        patch_response = self.client.patch(
            reverse("appointment-detail", args=[appointment.id]),
            {"status": Appointment.Status.CONFIRMED},
            format="json",
        )
        delete_response = self.client.delete(reverse("appointment-detail", args=[appointment.id]))
        appointment.refresh_from_db()

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(appointment.status, Appointment.Status.CANCELED)

        self.client.credentials()
        self.register_and_authenticate("other", "other@example.com")
        forbidden_response = self.client.get(reverse("appointment-detail", args=[appointment.id]))

        self.assertEqual(forbidden_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_appointment_and_availability(self):
        barber_shop = self.register_and_authenticate("public", "public@example.com")
        self.client.credentials()

        create_response = self.client.post(
            reverse("public-appointment"),
            {
                "barber_shop_id": barber_shop.id,
                "client_name": "Ana",
                "client_phone": "11777777777",
                "date": "2026-07-04",
                "time": "14:00",
            },
            format="json",
        )
        availability_response = self.client.get(
            reverse("public-availability", args=[barber_shop.id]),
            {"date": "2026-07-04"},
        )
        conflict_response = self.client.post(
            reverse("public-appointment"),
            {
                "barber_shop_id": barber_shop.id,
                "client_name": "Bia",
                "client_phone": "11666666666",
                "date": "2026-07-04",
                "time": "14:00",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["status"], Appointment.Status.PENDING)
        self.assertEqual(availability_response.status_code, status.HTTP_200_OK)
        self.assertEqual(availability_response.data["barber_shop_name"], barber_shop.name)
        self.assertIn("14:00", availability_response.data["occupied"])
        self.assertNotIn("14:00", availability_response.data["available"])
        self.assertEqual(conflict_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_appointment_does_not_require_authentication(self):
        barber_shop = self.register_and_authenticate("public-no-auth", "public-no-auth@example.com")
        self.client.credentials()

        response = self.client.post(
            reverse("public-appointment"),
            {
                "barber_shop_id": barber_shop.id,
                "client_name": "Cliente Publico",
                "client_phone": "11955554444",
                "date": "2026-07-05",
                "time": "15:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Appointment.Status.PENDING)
