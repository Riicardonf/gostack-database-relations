import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';

import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('Customer not exists');
    }

    const checkProductsExists = await this.productsRepository.findAllById(
      products,
    );

    if (!checkProductsExists.length) {
      throw new AppError('Product not found');
    }

    const existsProducts = checkProductsExists.map(product => product.id);

    const checkInexistent = products.filter(
      product => !existsProducts.includes(product.id),
    );

    if (checkInexistent.length) {
      throw new AppError(
        `Not found this products ${checkInexistent.map(product => product.id)}`,
      );
    }

    const productsNotAvailable = products.filter(
      product =>
        checkProductsExists.filter(i => i.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsNotAvailable.length) {
      throw new AppError('Product not available');
    }

    const productsToDatabase = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkProductsExists.filter(item => item.id === product.id)[0]
        .price,
    }));

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: productsToDatabase,
    });

    const newProductQuantity = products.map(product => ({
      id: product.id,
      quantity:
        checkProductsExists.filter(item => item.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(newProductQuantity);

    return order;
  }
}

export default CreateOrderService;
