const mysql = require('mysql2/promise');

const [host = 'localhost', user = 'root', password = '', port = '3306', database = 'woman_db'] = process.argv.slice(2);

(async () => {
  try {
    const conn = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      database
    });

    console.log('OK connected to MySQL');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
})();
