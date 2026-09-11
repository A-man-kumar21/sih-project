const GATEWAY_URL = "http://127.0.0.1:3001";

async function setup() {
  const email = `pan_test_${Date.now()}@test.com`;
  const password = "Password@123";

  const res = await fetch(`${GATEWAY_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      confirm_password: password,
      company_name: "Apex Solar Technologies Ltd",
      contact_person: "Vikas Sharma",
      phone: "9876543210",
    }),
  });

  const data = await res.json();
  console.log(JSON.stringify({ email, password, token: data.token }));
}

setup().catch(console.error);
