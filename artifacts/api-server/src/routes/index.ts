import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cookiesRouter from "./cookies";
import deliveryRouter from "./delivery";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cookiesRouter);
router.use(deliveryRouter);
router.use(ordersRouter);

export default router;
