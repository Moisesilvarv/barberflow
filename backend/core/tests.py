from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory
from rest_framework.test import APITestCase

from .models import Appointment, BarberShop, Client, Service, UserProfile
from .permissions import IsPlatformAdmin, SUSPENDED_BARBERSHOP_MESSAGE


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

    def test_token_endpoint_uses_email_login_serializer(self):
        self.client.post(reverse("register"), self.register_payload, format="json")

        response = self.client.post(
            reverse("token-obtain-pair"),
            {
                "email": self.register_payload["email"],
                "password": self.register_payload["password"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_admin_created_user_with_barber_shop_can_login_by_email(self):
        user = User.objects.create_user(
            username="Rhyan",
            email="tutosan5@gmail.com",
            password="M@1ses123",
        )
        BarberShop.objects.create(
            user=user,
            name="Rhyan Cortes",
            email="tutosan5@gmail.com",
            city="Santo Andre",
        )

        response = self.client.post(
            reverse("login"),
            {
                "email": "tutosan5@gmail.com",
                "password": "M@1ses123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["email"], "tutosan5@gmail.com")

    def test_user_without_barber_shop_cannot_login_as_barber_shop(self):
        User.objects.create_user(
            username="orphan",
            email="orphan@example.com",
            password="strong-pass-123",
        )

        response = self.client.post(
            reverse("login"),
            {
                "email": "orphan@example.com",
                "password": "strong-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_authentication_and_returns_user_barber_shop(self):
        self.client.post(reverse("register"), self.register_payload, format="json")
        login_response = self.client.post(
            reverse("login"),
            {
                "email": self.register_payload["email"],
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
                "email": self.register_payload["email"],
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


class PlatformAdminPermissionTests(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = IsPlatformAdmin()

    def build_request_for(self, user):
        request = self.factory.get("/internal/platform/")
        request.user = user
        return request

    def test_platform_admin_user_is_allowed(self):
        user = User.objects.create_user(username="admin", email="admin@example.com", password="pass")
        UserProfile.objects.create(user=user, is_platform_admin=True)

        request = self.build_request_for(user)

        self.assertTrue(self.permission.has_permission(request, None))

    def test_regular_user_is_denied(self):
        user = User.objects.create_user(username="barber", email="barber-user@example.com", password="pass")
        UserProfile.objects.create(user=user, is_platform_admin=False)

        request = self.build_request_for(user)

        self.assertFalse(self.permission.has_permission(request, None))

    def test_user_without_profile_is_denied(self):
        user = User.objects.create_user(username="legacy", email="legacy@example.com", password="pass")

        request = self.build_request_for(user)

        self.assertFalse(self.permission.has_permission(request, None))


class PlatformAdminApiTests(APITestCase):
    sensitive_keys = {"password", "token", "tokens", "access", "refresh", "secret", "secret_key"}

    def create_platform_admin(self):
        user = User.objects.create_user(
            username="platform-admin",
            email="platform-admin@example.com",
            password="strong-pass-123",
        )
        UserProfile.objects.create(user=user, is_platform_admin=True)
        return user

    def create_regular_barber(
        self,
        username="regular-barber",
        email="regular-barber@example.com",
        name="Regular Shop",
        status_value=BarberShop.Status.ACTIVE,
        plan=BarberShop.Plan.FREE,
    ):
        user = User.objects.create_user(
            username=username,
            email=email,
            password="strong-pass-123",
        )
        BarberShop.objects.create(
            user=user,
            name=name,
            email=user.email,
            city="Sao Paulo",
            status=status_value,
            plan=plan,
        )
        UserProfile.objects.create(user=user, is_platform_admin=False)
        return user

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def assert_no_sensitive_keys(self, data):
        if isinstance(data, dict):
            for key, value in data.items():
                normalized_key = str(key).lower()
                self.assertFalse(
                    any(sensitive_key in normalized_key for sensitive_key in self.sensitive_keys),
                    f"Campo sensivel exposto: {key}",
                )
                self.assert_no_sensitive_keys(value)
        elif isinstance(data, list):
            for item in data:
                self.assert_no_sensitive_keys(item)

    def test_platform_admin_can_access_dashboard(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        Client.objects.create(barber_shop=barber_shop, name="Cliente", phone="11999999999")
        Service.objects.create(barber_shop=barber_shop, name="Corte", price="50.00")
        Appointment.objects.create(
            barber_shop=barber_shop,
            client_name="Maria",
            client_phone="11999999999",
            date=timezone.localdate(),
            time="09:00",
        )
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["platform"]["total_barbershops"], 1)
        self.assertEqual(response.data["platform"]["active_barbershops"], 1)
        self.assertEqual(response.data["platform"]["suspended_barbershops"], 0)
        self.assertEqual(response.data["platform"]["new_barbershops_this_month"], 1)
        self.assertGreaterEqual(response.data["users"]["total_users"], 2)
        self.assertEqual(response.data["appointments"]["total"], 1)
        self.assertEqual(response.data["appointments"]["today"], 1)
        self.assertEqual(response.data["appointments"]["this_month"], 1)
        self.assertEqual(response.data["clients"]["total"], 1)
        self.assertEqual(response.data["services"]["total"], 1)
        self.assertEqual(len(response.data["growth"]["appointments_last_30_days"]), 30)
        self.assertEqual(len(response.data["recent_barbershops"]), 1)

    def test_platform_dashboard_returns_all_expected_keys_with_empty_database(self):
        admin_user = self.create_platform_admin()
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()),
            {
                "platform",
                "users",
                "appointments",
                "services",
                "clients",
                "growth",
                "recent_barbershops",
            },
        )
        self.assertEqual(response.data["platform"]["total_barbershops"], 0)
        self.assertEqual(response.data["appointments"]["total"], 0)
        self.assertEqual(response.data["services"]["total"], 0)
        self.assertEqual(response.data["clients"]["total"], 0)
        self.assertEqual(response.data["recent_barbershops"], [])
        self.assertEqual(len(response.data["growth"]["appointments_last_30_days"]), 30)

    def test_regular_user_receives_403_on_platform_routes(self):
        regular_user = self.create_regular_barber()
        self.authenticate(regular_user)

        dashboard_response = self.client.get(reverse("platform-dashboard"))
        list_response = self.client.get(reverse("platform-barbershop-list"))

        self.assertEqual(dashboard_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_user_receives_401_on_platform_routes(self):
        barber_user = self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email=barber_user.email)
        routes = [
            ("get", reverse("platform-dashboard")),
            ("get", reverse("platform-barbershop-list")),
            ("get", reverse("platform-barbershop-detail", args=[barber_shop.id])),
            ("patch", reverse("platform-barbershop-suspend", args=[barber_shop.id])),
            ("patch", reverse("platform-barbershop-reactivate", args=[barber_shop.id])),
        ]

        for method, url in routes:
            response = getattr(self.client, method)(url)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, url)

    def test_platform_admin_can_list_barbershops(self):
        admin_user = self.create_platform_admin()
        barber_user = self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email=barber_user.email)
        Client.objects.create(barber_shop=barber_shop, name="Cliente", phone="11999999999")
        Service.objects.create(barber_shop=barber_shop, name="Corte", price="50.00")
        Appointment.objects.create(
            barber_shop=barber_shop,
            client_name="Maria",
            client_phone="11999999999",
            date=timezone.localdate(),
            time="09:00",
        )
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["owner_email"], barber_user.email)
        self.assertEqual(response.data["results"][0]["status"], BarberShop.Status.ACTIVE)
        self.assertEqual(response.data["results"][0]["plan"], BarberShop.Plan.FREE)
        self.assertEqual(response.data["results"][0]["appointments_count"], 1)
        self.assertEqual(response.data["results"][0]["services_count"], 1)
        self.assertEqual(response.data["results"][0]["clients_count"], 1)

    def test_platform_barbershop_list_returns_expected_fields(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data["results"][0]
        self.assertTrue(
            {
                "id",
                "name",
                "owner_email",
                "owner_name",
                "status",
                "plan",
                "created_at",
                "last_login",
            }.issubset(result.keys())
        )
        self.assert_no_sensitive_keys(response.data)

    def test_platform_barbershop_list_search_by_name(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber(username="alpha", email="alpha@example.com", name="Alpha Cortes")
        self.create_regular_barber(username="beta", email="beta@example.com", name="Beta Barber")
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"), {"search": "alpha"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "Alpha Cortes")

    def test_platform_barbershop_list_search_by_owner_email(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber(username="alpha", email="alpha@example.com", name="Alpha Cortes")
        self.create_regular_barber(username="beta", email="beta@example.com", name="Beta Barber")
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"), {"search": "beta@example.com"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["owner_email"], "beta@example.com")

    def test_platform_barbershop_list_filter_by_status(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber(username="active", email="active@example.com", name="Active Shop")
        self.create_regular_barber(
            username="suspended",
            email="suspended@example.com",
            name="Suspended Shop",
            status_value=BarberShop.Status.SUSPENDED,
        )
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"), {"status": "SUSPENDED"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["status"], BarberShop.Status.SUSPENDED)

    def test_platform_barbershop_list_filter_by_plan(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber(username="free", email="free@example.com", name="Free Shop")
        self.create_regular_barber(
            username="premium",
            email="premium@example.com",
            name="Premium Shop",
            plan=BarberShop.Plan.PREMIUM,
        )
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"), {"plan": "PREMIUM"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["plan"], BarberShop.Plan.PREMIUM)

    def test_platform_barbershop_list_pagination(self):
        admin_user = self.create_platform_admin()
        for index in range(12):
            self.create_regular_barber(
                username=f"barber-{index}",
                email=f"barber-{index}@example.com",
                name=f"Barbearia {index}",
            )
        self.authenticate(admin_user)

        first_page = self.client.get(reverse("platform-barbershop-list"), {"page_size": 5})
        second_page = self.client.get(reverse("platform-barbershop-list"), {"page": 2, "page_size": 5})

        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data["count"], 12)
        self.assertEqual(len(first_page.data["results"]), 5)
        self.assertEqual(len(second_page.data["results"]), 5)
        self.assertNotEqual(
            first_page.data["results"][0]["id"],
            second_page.data["results"][0]["id"],
        )

    def test_platform_barbershop_list_empty_database_does_not_break(self):
        admin_user = self.create_platform_admin()
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["results"], [])

    def test_platform_admin_can_get_barbershop_detail(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        Service.objects.create(barber_shop=barber_shop, name="Corte", price="50.00")
        Client.objects.create(barber_shop=barber_shop, name="Cliente", phone="11999999999")
        Appointment.objects.create(
            barber_shop=barber_shop,
            client_name="Maria",
            client_phone="11999999999",
            date=timezone.localdate(),
            time="09:00",
        )
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-detail", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], barber_shop.id)
        self.assertEqual(response.data["plan"], BarberShop.Plan.FREE)
        self.assertEqual(response.data["owner"]["email"], barber_shop.user.email)
        self.assertEqual(response.data["metrics"]["total_appointments"], 1)
        self.assertEqual(response.data["metrics"]["appointments_today"], 1)
        self.assertEqual(response.data["metrics"]["appointments_this_month"], 1)
        self.assertEqual(response.data["metrics"]["total_clients"], 1)
        self.assertEqual(response.data["metrics"]["total_services"], 1)
        self.assertEqual(len(response.data["latest_appointments"]), 1)
        self.assertEqual(len(response.data["services"]), 1)
        self.assertEqual(response.data["public_link"], f"/public/{barber_shop.id}")
        self.assertTrue(
            {
                "id",
                "name",
                "email",
                "city",
                "status",
                "plan",
                "created_at",
                "updated_at",
                "owner",
                "metrics",
                "latest_appointments",
                "services",
                "public_link",
            }.issubset(response.data.keys())
        )

    def test_regular_user_receives_403_on_barbershop_detail(self):
        regular_user = self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email=regular_user.email)
        self.authenticate(regular_user)

        response = self.client.get(reverse("platform-barbershop-detail", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_platform_barbershop_detail_does_not_expose_sensitive_data(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-detail", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("password", response.data)
        self.assertNotIn("password", response.data["owner"])
        self.assertNotIn("is_staff", response.data["owner"])
        self.assertNotIn("is_superuser", response.data["owner"])
        self.assert_no_sensitive_keys(response.data)

    def test_missing_barbershop_returns_404(self):
        admin_user = self.create_platform_admin()
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-barbershop-detail", args=[99999]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_platform_admin_can_suspend_and_reactivate_barbershop(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        self.authenticate(admin_user)

        suspend_response = self.client.patch(reverse("platform-barbershop-suspend", args=[barber_shop.id]))
        barber_shop.refresh_from_db()

        self.assertEqual(suspend_response.status_code, status.HTTP_200_OK)
        self.assertEqual(suspend_response.data["detail"], "Barbearia suspensa com sucesso.")
        self.assertEqual(suspend_response.data["barbershop"]["id"], barber_shop.id)
        self.assertEqual(suspend_response.data["barbershop"]["status"], "SUSPENDED")
        self.assertEqual(barber_shop.status, BarberShop.Status.SUSPENDED)
        self.assertIsNotNone(barber_shop.suspended_at)
        self.assertEqual(barber_shop.suspended_by, admin_user)

        reactivate_response = self.client.patch(reverse("platform-barbershop-reactivate", args=[barber_shop.id]))
        barber_shop.refresh_from_db()

        self.assertEqual(reactivate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reactivate_response.data["detail"], "Barbearia reativada com sucesso.")
        self.assertEqual(reactivate_response.data["barbershop"]["status"], "ACTIVE")
        self.assertEqual(barber_shop.status, BarberShop.Status.ACTIVE)
        self.assertIsNotNone(barber_shop.reactivated_at)

    def test_regular_user_receives_403_when_trying_to_suspend_or_reactivate(self):
        regular_user = self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email=regular_user.email)
        self.authenticate(regular_user)

        suspend_response = self.client.patch(reverse("platform-barbershop-suspend", args=[barber_shop.id]))
        reactivate_response = self.client.patch(reverse("platform-barbershop-reactivate", args=[barber_shop.id]))

        self.assertEqual(suspend_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(reactivate_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_suspend_missing_barbershop_returns_404(self):
        admin_user = self.create_platform_admin()
        self.authenticate(admin_user)

        response = self.client.patch(reverse("platform-barbershop-suspend", args=[99999]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_reactivate_missing_barbershop_returns_404(self):
        admin_user = self.create_platform_admin()
        self.authenticate(admin_user)

        response = self.client.patch(reverse("platform-barbershop-reactivate", args=[99999]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_suspending_already_suspended_barbershop_does_not_break(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber(status_value=BarberShop.Status.SUSPENDED)
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        self.authenticate(admin_user)

        response = self.client.patch(reverse("platform-barbershop-suspend", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Barbearia ja estava suspensa.")
        self.assertEqual(response.data["barbershop"]["status"], "SUSPENDED")

    def test_reactivating_already_active_barbershop_does_not_break(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        self.authenticate(admin_user)

        response = self.client.patch(reverse("platform-barbershop-reactivate", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Barbearia ja estava ativa.")
        self.assertEqual(response.data["barbershop"]["status"], "ACTIVE")

    def test_suspended_barbershop_cannot_access_private_routes(self):
        suspended_user = self.create_regular_barber(status_value=BarberShop.Status.SUSPENDED)
        self.authenticate(suspended_user)

        me_response = self.client.get(reverse("me"))
        appointments_response = self.client.get(reverse("appointment-list"))

        self.assertEqual(me_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(appointments_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(me_response.data["detail"], SUSPENDED_BARBERSHOP_MESSAGE)

    def test_suspended_barbershop_login_returns_friendly_error(self):
        self.create_regular_barber(status_value=BarberShop.Status.SUSPENDED)

        response = self.client.post(
            reverse("login"),
            {
                "email": "regular-barber@example.com",
                "password": "strong-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(SUSPENDED_BARBERSHOP_MESSAGE, str(response.data))

    def test_platform_admin_continues_accessing_admin_routes(self):
        admin_user = self.create_platform_admin()
        self.authenticate(admin_user)

        response = self.client.get(reverse("platform-dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_suspending_barbershop_does_not_delete_tenant_data(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber()
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        Client.objects.create(barber_shop=barber_shop, name="Cliente", phone="11999999999")
        Service.objects.create(barber_shop=barber_shop, name="Corte", price="50.00")
        Appointment.objects.create(
            barber_shop=barber_shop,
            client_name="Maria",
            client_phone="11999999999",
            date=timezone.localdate(),
            time="09:00",
        )
        self.authenticate(admin_user)

        response = self.client.patch(reverse("platform-barbershop-suspend", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.filter(id=barber_shop.user_id).exists())
        self.assertEqual(Client.objects.filter(barber_shop=barber_shop).count(), 1)
        self.assertEqual(Service.objects.filter(barber_shop=barber_shop).count(), 1)
        self.assertEqual(Appointment.objects.filter(barber_shop=barber_shop).count(), 1)

    def test_reactivating_barbershop_does_not_delete_tenant_data(self):
        admin_user = self.create_platform_admin()
        self.create_regular_barber(status_value=BarberShop.Status.SUSPENDED)
        barber_shop = BarberShop.objects.get(email="regular-barber@example.com")
        Client.objects.create(barber_shop=barber_shop, name="Cliente", phone="11999999999")
        Service.objects.create(barber_shop=barber_shop, name="Corte", price="50.00")
        Appointment.objects.create(
            barber_shop=barber_shop,
            client_name="Maria",
            client_phone="11999999999",
            date=timezone.localdate(),
            time="09:00",
        )
        self.authenticate(admin_user)

        response = self.client.patch(reverse("platform-barbershop-reactivate", args=[barber_shop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.filter(id=barber_shop.user_id).exists())
        self.assertEqual(Client.objects.filter(barber_shop=barber_shop).count(), 1)
        self.assertEqual(Service.objects.filter(barber_shop=barber_shop).count(), 1)
        self.assertEqual(Appointment.objects.filter(barber_shop=barber_shop).count(), 1)


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
                "email": email,
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

    def test_invalid_phone_is_blocked(self):
        self.register_and_authenticate("invalid-phone", "invalid-phone@example.com")

        response = self.client.post(
            reverse("appointment-list"),
            {
                "client_name": "Maria",
                "client_phone": "123",
                "date": "2026-07-02",
                "time": "09:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("client_phone", response.data)

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

    def test_public_availability_does_not_expose_private_client_data(self):
        barber_shop = self.register_and_authenticate("public-safe", "public-safe@example.com")
        Appointment.objects.create(
            barber_shop=barber_shop,
            client_name="Cliente Privado",
            client_phone="11911112222",
            date="2026-07-06",
            time="16:00",
        )
        self.client.credentials()

        response = self.client.get(
            reverse("public-availability", args=[barber_shop.id]),
            {"date": "2026-07-06"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("16:00", response.data["occupied"])
        self.assertNotIn("Cliente Privado", str(response.data))
        self.assertNotIn("11911112222", str(response.data))
