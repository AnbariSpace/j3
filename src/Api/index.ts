import {Router} from "express";
import InternalRouter from "./Internal";

const router = Router();
router.use("/api/internal/", InternalRouter);

export default router;