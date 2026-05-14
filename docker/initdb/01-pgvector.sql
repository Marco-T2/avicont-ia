-- Activa la extensión pgvector para el RAG.
-- Este script corre UNA sola vez: cuando el volume avicont_pgdata se crea vacío.
CREATE EXTENSION IF NOT EXISTS vector;
