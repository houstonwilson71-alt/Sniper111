import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import tokensRouter from "./tokens";
import tradesRouter from "./trades";
import positionsRouter from "./positions";
import performanceRouter from "./performance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(tokensRouter);
router.use(tradesRouter);
router.use(positionsRouter);
router.use(performanceRouter);

export default router;
