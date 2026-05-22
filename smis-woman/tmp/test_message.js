(async ()=>{
  try {
    const base = 'http://localhost:5000/api';

    const loginRes = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tech@smsi.com', password: 'Tech@SMSI2026' })
    });

    const loginJson = await loginRes.json();
    console.log('LOGIN', loginJson);

    if (!loginJson?.success || !loginJson.token) {
      console.error('Login failed, aborting test');
      process.exit(1);
    }

    const token = loginJson.token;
    const userId = loginJson.user?.id;

    const postRes = await fetch(base + '/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: 'Automated test message from technician (integration test)' })
    });

    const postJson = await postRes.json();
    console.log('POST', postJson);

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
