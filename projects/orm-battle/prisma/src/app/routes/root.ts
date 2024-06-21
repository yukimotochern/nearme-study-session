import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'postgres://user:password@127.0.0.1:7006/db',
});

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async function () {
    // create supplier
    await prisma.supplier.createMany({
      data: [
        {
          companyName: 'TestCompanyName1',
          city: 'TestCity1',
          country: 'TestCountry1',
        },
        {
          companyName: 'TestCompanyName2',
          city: 'TestCity2',
          country: 'TestCountry2',
        },
      ],
    });

    // create products
    await prisma.product.createMany({
      data: [
        {
          name: 'TestProductName1',
          supplierId: 1,
          unitPrice: 10,
          unitsInStock: 20,
        },
        {
          name: 'TestProductName2',
          supplierId: 1,
          unitPrice: 25,
          unitsInStock: 7,
        },
        {
          name: 'TestProductName3',
          supplierId: 2,
          unitPrice: 50,
          unitsInStock: 17,
        },
        {
          name: 'TestProductName4',
          supplierId: 2,
          unitPrice: 100,
          unitsInStock: 2,
        },
      ],
    });

    // get product 2
    const product = await prisma.product.findUnique({
      where: { id: 2 },
      include: {
        supplier: true,
      },
    });

    // get products
    const whereOptions: Prisma.ProductWhereInput = {
      name: { contains: 'test', mode: 'insensitive' },
    };
    const [response, count] = await Promise.all([
      prisma.product.findMany({
        where: whereOptions,
        take: 10,
        skip: 0,
        select: {
          id: true,
          name: true,
          unitPrice: true,
          unitsInStock: true,
        },
      }),
      prisma.product.count({ where: whereOptions }),
    ]);

    // transaction
    const orderDetailQuery = prisma.orderDetail.deleteMany({
      where: { orderId: 1 },
    });
    const orderQuery = prisma.order.deleteMany({
      where: { id: 1 },
    });
    await prisma.$transaction([orderDetailQuery, orderQuery]);

    // insert order
    await prisma.order.create({
      data: {
        orderDate: new Date(),
        shipAddress: 'address',
        shipCountry: 'Japan',
        orderDetails: {
          create: {
            quantity: 10,
            product: {
              create: {
                name: 'TestProductName1',
                supplierId: 1,
                unitPrice: 10,
                unitsInStock: 20,
              },
            },
          },
        },
      },
    });

    // aggregate over orders
    const order = await prisma.order.findFirst({
      where: { id: 0 },
      select: {
        id: true,
        orderDate: true,
        shipCountry: true,
      },
    });
    if (!order) {
      throw new Error('Order not found');
    }
    const { _count, _sum } = await prisma.orderDetail.aggregate({
      where: { orderId: 0 },
      _sum: {
        quantity: true,
      },
      _count: {
        orderId: true,
      },
    });
    const totalPrice = await prisma.$queryRaw<number>`
        SELECT SUM(p."unitPrice" * od.quantity) as "totalPrice"
        FROM order_details od
        JOIN products p on od."productId" = p.id
        WHERE "orderId" = ${0}
      `;

    return { message: 'Hello API', totalPrice };
  });
}
