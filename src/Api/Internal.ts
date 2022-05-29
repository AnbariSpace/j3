import { Router } from "express";
import { runController } from "../utilties";
import HealthCheckController from "./Controllers/Internal/HealthCheckController";
import BackendController from "./Controllers/Internal/BackendController";
import DatabaseController from "./Controllers/Internal/DatabaseController";
import bodyParser from "body-parser";

const router = Router();

router.get("/backends", runController(BackendController, BackendController.prototype.list));
router.get("/backends/:backend", runController(BackendController, BackendController.prototype.getBackend));
router.put("/backends/:backend/objects/:bucket/:key*", runController(BackendController, BackendController.prototype.putObject));
router.get("/backends/:backend/objects/:bucket/:key*", runController(BackendController, BackendController.prototype.getObject));
router.post("/database/apply-updates", bodyParser.json(), runController(DatabaseController, DatabaseController.prototype.applyUpdates));
router.get("/health-check", runController(HealthCheckController, HealthCheckController.prototype.handle));

export default router;