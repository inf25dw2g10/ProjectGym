#!/bin/sh
set -e

echo "A correr migrations..."
until npx sequelize-cli db:migrate --env production 2>/dev/null; do
  sleep 5
done

echo "A inserir seeders..."
npx sequelize-cli db:seed:all --env production 2>/dev/null || echo "Seeders já aplicados ou ignorados."

echo "Base de dados pronta. A iniciar servidor..."
exec npm start
