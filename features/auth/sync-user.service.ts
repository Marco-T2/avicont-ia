import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { UsersService } from "@/features/users/server";
import { AppError, NotFoundError } from "@/features/shared/errors";

const usersService = new UsersService();

export async function syncUserToDatabase() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return null;
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress || "";
    const name =
      `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

    // Verificar si el usuario existe en la base de datos.
    // Solo tratamos NotFoundError como "no existe todavía"; cualquier otro
    // error (DB caída, timeout, error inesperado) se propaga, para no caer
    // silenciosamente en findOrCreate y crear un duplicado.
    const existing = await usersService
      .resolveByClerkId(clerkUser.id)
      .catch((err) => {
        if (err instanceof NotFoundError) return null;
        throw err;
      });

    let dbUser;
    if (existing) {
      // Actualizar usuario existente
      dbUser = await usersService.update(existing.id, {
        email,
        name: name || existing.name,
      });
    } else {
      // Crear un nuevo usuario en la base de datos
      dbUser = await usersService.findOrCreate({
        clerkUserId: clerkUser.id,
        email,
        name: name || "User",
      });
      console.log(`New user created: ${email}`);
    }

    return dbUser;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error("Error syncing user from Clerk:", error);
    throw new AppError("Error sincronizando usuario desde Clerk", 500, "SYNC_USER_FAILED");
  }
}
