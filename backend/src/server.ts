import { createServer } from "node:http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { createVoiceService } from "./modules/voice/voice.service.js";
import { registerVoiceStream } from "./modules/voice/voice-stream.js";
import { createRepositories } from "./repositories/create-repositories.js";
import { createApp } from "./app.js";

const repositories = createRepositories();
const app = createApp({ repositories });
const server = createServer(app);
registerVoiceStream(server, createVoiceService(repositories), repositories);

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      frontendOrigin: env.FRONTEND_ORIGIN,
    },
    "Backend server is listening.",
  );
});
