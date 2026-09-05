const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'spotit_clave_secreta_temporal';

app.use(express.json());

app.get('/', (req, res) => {
  res.send('¡SpotIt backend funcionando!');
});

// ---------- AUTENTICACIÓN ----------

app.post('/registro', async (req, res) => {
  const { nombre, correo, contrasena, rol } = req.body;

  try {
    const hash = await bcrypt.hash(contrasena, 10);

    db.query(
      'INSERT INTO usuario (nombre, correo, contrasena, rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, hash, rol || 'usuario'],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Error al registrar usuario' });
        }
        res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
      }
    );
  } catch (error) {
    console.error('Error capturado:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;

  db.query(
    'SELECT * FROM usuario WHERE correo = ?',
    [correo],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error del servidor' });
      }

      if (results.length === 0) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      const usuario = results[0];
      const coincide = await bcrypt.compare(contrasena, usuario.contrasena);

      if (!coincide) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      const token = jwt.sign(
        { id: usuario.id, rol: usuario.rol },
        SECRET_KEY,
        { expiresIn: '2h' }
      );

      res.json({ mensaje: 'Login exitoso', token, rol: usuario.rol });
    }
  );
});

// ---------- ESPACIOS ----------

app.post('/espacios', (req, res) => {
  const { nombre, tipo, capacidad } = req.body;

  db.query(
    'INSERT INTO espacio (nombre, tipo, capacidad) VALUES (?, ?, ?)',
    [nombre, tipo, capacidad],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al crear espacio' });
      }
      res.status(201).json({ mensaje: 'Espacio creado correctamente' });
    }
  );
});

app.get('/espacios', (req, res) => {
  db.query('SELECT * FROM espacio WHERE estado = "activo"', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener espacios' });
    }
    res.json(results);
  });
});

// ---------- RESERVAS ----------

app.post('/reservas', (req, res) => {
  const { usuario_id, espacio_id, fecha, hora_inicio, hora_fin } = req.body;

  const queryValidacion = `
    SELECT * FROM reserva 
    WHERE espacio_id = ? 
    AND fecha = ? 
    AND estado = 'activa'
    AND (
      (hora_inicio < ? AND hora_fin > ?) OR
      (hora_inicio < ? AND hora_fin > ?) OR
      (hora_inicio >= ? AND hora_fin <= ?)
    )
  `;

  db.query(
    queryValidacion,
    [espacio_id, fecha, hora_fin, hora_inicio, hora_inicio, hora_inicio, hora_inicio, hora_fin],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al validar disponibilidad' });
      }

      if (results.length > 0) {
        return res.status(409).json({ error: 'Ese horario ya está reservado' });
      }

      db.query(
        'INSERT INTO reserva (usuario_id, espacio_id, fecha, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)',
        [usuario_id, espacio_id, fecha, hora_inicio, hora_fin],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al crear reserva' });
          }
          res.status(201).json({ mensaje: 'Reserva creada correctamente' });
        }
      );
    }
  );
});

app.get('/reservas', (req, res) => {
  db.query(
    `SELECT r.*, u.nombre AS usuario, e.nombre AS espacio 
     FROM reserva r
     JOIN usuario u ON r.usuario_id = u.id
     JOIN espacio e ON r.espacio_id = e.id
     WHERE r.estado = 'activa'`,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener reservas' });
      }
      res.json(results);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
