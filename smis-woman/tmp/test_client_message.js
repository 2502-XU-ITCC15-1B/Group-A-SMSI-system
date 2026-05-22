(async ()=>{
  try {
    const base = 'http://localhost:5000/api';
    const email = 'test.client+1@example.com';

    // Register new client
    const regRes = await fetch(base + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Client', email, password: 'TestPass123' })
    });

    const regJson = await regRes.json();
    console.log('REGISTER', regJson);

    if (!regJson?.success || !regJson.token) {
      console.error('Register failed, aborting test');
      process.exit(1);
    }

    const token = regJson.token;
    const userId = regJson.user?.id;

    // Send a message
    const postRes = await fetch(base + '/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: 'Hello admin, this is a test from client.' })
    });

    const postJson = await postRes.json();
    console.log('POST', postJson);

    // Fetch thread
    const getRes = await fetch(base + `/messages/user/${userId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const getJson = await getRes.json();
    console.log('GET', getJson);

  } catch (err) {
    console.error('ERR', err);
    process.exit(1);
  }
})();
