Fixtures del QA del fanzine (issue #14): mini `dist/` y `contenido/` con
errores a propósito para probar que cada chequeo falla cuando debe
(`npm run qa:test`, tests en `tests/qa/*.test.mjs`). Viven fuera de `src/`
para que nunca se publiquen. El PDF con un correo se genera en un
directorio temporal durante el test (pdf-lib), no se commitea.
