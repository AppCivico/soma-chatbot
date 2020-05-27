const cont = require('./mock_data/context');
const flow = require('../app/utils/flow');
const dialogs = require('../app/utils/dialogs');
const attach = require('../app/utils/attach');
const { sendMainMenu } = require('../app/utils/mainMenu');
const help = require('../app/utils/helper');
const somaAPI = require('../app/soma_api');
const somaApiData = require('./mock_data/somaApiData');

jest.mock('../app/utils/checkQR');
jest.mock('../app/utils/mainMenu');
jest.mock('../app/utils/attach');
jest.mock('../app/soma_api');

jest
	.spyOn(somaAPI, 'linkUser')
	.mockImplementation((fbId, cpf) => somaApiData.linkUser[cpf]);

jest
	.spyOn(somaAPI, 'activateToken')
	.mockImplementation((fbId, cpf, token) => somaApiData.activateToken[token]);

jest
	.spyOn(somaAPI, 'getSchoolBalance')
	.mockImplementation((fbId, userId) => somaApiData.getSchoolBalance[userId]);


describe('sendPointsMsg', () => {
	const fullMsg = flow.schoolPoints.text2;
	const pointMsg = flow.schoolPoints.text3;

	it('No kilos - send pointMsg', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		const userBalance = 100;
		const residues = [];
		await dialogs.sendPointsMsg(context, residues, userBalance, fullMsg, pointMsg);

		await expect(context.sendText).toBeCalledWith(pointMsg.replace('<POINTS>', userBalance));
	});

	it('With kilos - send fullMsg', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		const userBalance = 100;
		const residues = [
			{ name: 'foo', amount: 10, unitType: 'Kilogram' },
			{ name: 'bar', amount: 15, unitType: 'Kilogram' },
		];
		const expectedKilos = 25;
		await dialogs.sendPointsMsg(context, residues, userBalance, fullMsg, pointMsg);

		await expect(context.sendText).toBeCalledWith(fullMsg.replace('<KILOS>', expectedKilos).replace('<POINTS>', userBalance));
	});
});

describe('schoolPoints', () => {
	const fullMsg = flow.schoolPoints.text2;
	const pointMsg = flow.schoolPoints.text3;
	it('schoolData has kilos and points - send full message and goes to menu', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		context.state.somaUser = { id: 1 };
		const expectedKilos = 25;
		const expectedBalance = 1000;

		await dialogs.schoolPoints(context);

		await expect(context.setState).toBeCalled();
		await expect(context.sendText).toBeCalledWith(flow.schoolPoints.text1);

		await expect(context.sendText).toBeCalledWith(fullMsg.replace('<KILOS>', expectedKilos).replace('<POINTS>', expectedBalance));
		await expect(context.sendText).not.toBeCalledWith(flow.schoolPoints.failure);
		await expect(sendMainMenu).toBeCalledWith(context, false, 3 * 1000);
	});

	it('schoolData has no kilos - send points message and goes to menu', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		context.state.somaUser = { id: 2 };
		const expectedBalance = 1000;

		await dialogs.schoolPoints(context);

		await expect(context.setState).toBeCalled();
		await expect(context.sendText).toBeCalledWith(flow.schoolPoints.text1);

		await expect(context.sendText).toBeCalledWith(pointMsg.replace('<POINTS>', expectedBalance));
		await expect(context.sendText).not.toBeCalledWith(flow.schoolPoints.failure);
		await expect(sendMainMenu).toBeCalledWith(context, false, 3 * 1000);
	});

	it('Failure retrieving schoolData - send failure message and goes to menu', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		context.state.somaUser = { id: 3 };

		await dialogs.schoolPoints(context);

		await expect(context.setState).toBeCalled();
		await expect(context.sendText).not.toBeCalledWith(flow.schoolPoints.text1);
		await expect(context.sendText).toBeCalledWith(flow.schoolPoints.failure);
		await expect(sendMainMenu).toBeCalledWith(context, false, 3 * 1000);
	});
});

describe('handleCPF', () => {
	it('CPF inválido - mostra mensagem e pede de novo', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		context.state.whatWasTyped = 'foobar';
		await dialogs.handleCPF(context);

		await expect(context.sendText).toBeCalledWith(flow.joinAsk.invalid);
		await expect(context.setState).toBeCalledWith({ dialog: 'joinAsk' });
	});

	it('CPF válido - verifica se cpf está cadastrado', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		context.state.whatWasTyped = '123.123.123-11';
		await dialogs.handleCPF(context);

		await expect(context.sendText).not.toBeCalledWith(flow.joinAsk.invalid);
	});
});

describe('linkUserAPI', () => {
	it('200 - CPF encontrado - mostra mensagem e manda pro menu', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		const cpf = 1;
		await dialogs.linkUserAPI(context, cpf);

		await expect(somaAPI.linkUser).toBeCalledWith(context.session.user.id, cpf);
		await expect(context.sendText).toBeCalledWith(flow.joinAsk.success);
		await expect(context.setState).toBeCalledWith({ cpf, linked: true });
		await expect(context.setState).toBeCalledWith({ dialog: 'activateSMS' });
	});

	it('404 - CPF não encontrado - mostra mensagem de erro e pede de novo', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		const cpf = 2;
		await dialogs.linkUserAPI(context, cpf);

		await expect(somaAPI.linkUser).toBeCalledWith(context.session.user.id, cpf);
		await expect(context.sendText).toBeCalledWith(flow.joinAsk.notFound);
		await expect(context.setState).toBeCalledWith({ dialog: 'joinAsk' });
	});

	it('409 - CPF repetido - mostra mensagem de erro e pede de novo', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		const cpf = 3;
		await dialogs.linkUserAPI(context, cpf);

		await expect(somaAPI.linkUser).toBeCalledWith(context.session.user.id, cpf);
		await expect(context.sendText).toBeCalledWith(flow.joinAsk.alreadyLinked);
		await expect(context.setState).toBeCalledWith({ dialog: 'joinAsk' });
	});

	it('400 - Outro status - mostra mensagem de erro e pede de novo', async () => {
		const context = cont.quickReplyContext('greetings', 'greetings');
		const cpf = 4;
		await dialogs.linkUserAPI(context, cpf);

		await expect(somaAPI.linkUser).toBeCalledWith(context.session.user.id, cpf);
		await expect(context.sendText).toBeCalledWith(flow.joinAsk.notFound);
		await expect(context.setState).toBeCalledWith({ dialog: 'joinAsk' });
	});
});

describe('handleSMS', () => {
	it('Valid Token - manda mensagem, salva somaUser e vai pro menu', async () => {
		const context = cont.quickReplyContext();
		context.state.whatWasTyped = 1;
		const somaUser = somaApiData.activateToken[context.state.whatWasTyped];
		await dialogs.handleSMS(context);

		await expect(somaAPI.activateToken).toBeCalledWith(context.session.user.id, context.state.cpf, context.state.whatWasTyped);
		await expect(context.sendText).toBeCalledWith(flow.SMSToken.success);
		await expect(context.setState).toBeCalledWith({ somaUser });
		await expect(context.setState).toBeCalledWith({ dialog: 'mainMenu' });
	});

	it('invalid Token - manda mensagem de erro e tenta de novo', async () => {
		const context = cont.quickReplyContext();
		context.state.whatWasTyped = 2;
		await dialogs.handleSMS(context);

		await expect(somaAPI.activateToken).toBeCalledWith(context.session.user.id, context.state.cpf, context.state.whatWasTyped);
		await expect(context.sendText).toBeCalledWith(flow.SMSToken.error);
		await expect(context.setState).toBeCalledWith({ dialog: 'activateSMSAsk' });
	});
});

describe('checkData', () => {
	it('Tudo certo - segue fluxo', async () => {
		const context = cont.quickReplyContext();
		const userBalance = { balance: 10 };
		const rewards = [{ id: 1 }];

		const res = await dialogs.checkData(context, userBalance, rewards);
		await expect(context.setState).toBeCalledWith({ userBalance, rewards });
		await expect(res).toBe(true);
	});

	it('Falha ao carregar userBalance - manda msg de erro e volta pro menu', async () => {
		const context = cont.quickReplyContext();
		const userBalance = null;
		const rewards = [{ id: 1 }];

		const res = await dialogs.checkData(context, userBalance, rewards);
		await expect(context.setState).toBeCalledWith({ userBalance, rewards });
		await expect(context.sendText).toBeCalledWith(flow.myPoints.failure);
		await expect(sendMainMenu).toBeCalledWith(context);
		await expect(res).toBe(false);
	});

	it('Falha ao carregar rewards - manda msg de erro e volta pro menu', async () => {
		const context = cont.quickReplyContext();
		const userBalance = { balance: 10 };
		const rewards = null;

		const res = await dialogs.checkData(context, userBalance, rewards);
		await expect(context.setState).toBeCalledWith({ userBalance, rewards });
		await expect(context.sendText).toBeCalledWith(flow.myPoints.failure);
		await expect(sendMainMenu).toBeCalledWith(context);
		await expect(res).toBe(false);
	});
});

// describe('myPoints', () => {
// 	it('Usuário não tem nenhum ponto - Vê msg e vai pro menu', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		userBalance.balance = 0;
// 		context.state.userBalance = userBalance;
// 		const rewards = { ...baseRewards };

// 		await dialogs.myPoints(context, userBalance, rewards);

// 		await expect(context.setState).toBeCalledWith({ userBalance });
// 		await expect(context.sendText).toBeCalledWith(flow.myPoints.noPoints);
// 		await expect(sendMainMenu).toBeCalledWith(context);
// 	});

// 	it('Usuário pode comprar algo - Vê msg que oferece troca', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		const rewards = [...baseRewards];
// 		userBalance.balance = 20;
// 		context.state.userBalance = userBalance;

// 		await dialogs.myPoints(context, userBalance, rewards);

// 		await expect(context.setState).toBeCalledWith({ userBalance });
// 		await expect(context.sendText).toBeCalledWith(flow.myPoints.showPoints
// 			.replace('<KILOS>', context.state.userBalance.user_plastic)
// 			.replace('<POINTS>', context.state.userBalance.balance));
// 		await expect(context.sendText).toBeCalledWith(flow.myPoints.hasEnough, await attach.getQR(flow.myPoints));
// 	});

// 	it('Usuário não pode comprar nada - Vê msg que oferece ver todos', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		const rewards = [...baseRewards];
// 		userBalance.balance = 1;
// 		context.state.userBalance = userBalance;

// 		await dialogs.myPoints(context, userBalance, rewards);

// 		await expect(context.setState).toBeCalledWith({ userBalance });
// 		await expect(context.sendText).toBeCalledWith(flow.myPoints.showPoints
// 			.replace('<KILOS>', context.state.userBalance.user_plastic)
// 			.replace('<POINTS>', context.state.userBalance.balance));

// 		const cheapest = await help.getSmallestPoint(rewards);
// 		await expect(context.sendText).toBeCalledWith(flow.myPoints.notEnough.replace('<POINTS>', cheapest), await attach.getQR(flow.notEnough));
// 	});
// });

// describe('showProducts', () => {
// 	it('Usuário pode comprar algo - Vê msg que oferece troca', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		const rewards = [...baseRewards];
// 		userBalance.balance = 20;
// 		context.state.userBalance = userBalance;

// 		await dialogs.showProducts(context, userBalance, rewards);

// 		await expect(context.setState).toBeCalledWith({ userBalance });

// 		await expect(context.sendText).toBeCalledWith(flow.showProducts.text1, await attach.getQR(flow.showProducts));
// 	});

// 	it('Usuário não pode comprar nada - Vê duas msgs e todos os produtos', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		const rewards = [...baseRewards];
// 		userBalance.balance = 1;
// 		context.state.userBalance = userBalance;

// 		await dialogs.showProducts(context, userBalance, rewards);

// 		await expect(context.setState).toBeCalledWith({ userBalance });

// 		await expect(context.sendText).toBeCalledWith(flow.showProducts.noPoints1);
// 		await expect(context.sendText).toBeCalledWith(flow.showProducts.noPoints2);
// 		// viewAllProducts
// 		await expect(attach.sendAllProductsCarrousel).toBeCalledWith(context, context.state.userBalance.balance, rewards, 1);
// 		await expect(sendMainMenu).toBeCalledWith(context, null, 1000 * 3);
// 	});
// });

// describe('viewAllProducts', () => {
// 	it('Sucesso - manda o carrousel com todos os produtos e o menu', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		const rewards = [...baseRewards];
// 		const pageNumber = 1;

// 		await dialogs.viewAllProducts(context, userBalance, rewards, pageNumber);

// 		await expect(attach.sendAllProductsCarrousel).toBeCalledWith(context, userBalance.balance, rewards, pageNumber);
// 		await expect(sendMainMenu).toBeCalledWith(context, null, 1000 * 3);
// 	});
// });

// describe('viewUserProducts', () => {
// 	it('Sucesso - manda o carrousel com os produtos do e o menu', async () => {
// 		const context = cont.quickReplyContext('foobar');
// 		const userBalance = { ...baseBalance };
// 		const rewards = [...baseRewards];
// 		const pageNumber = 1;


// 		await dialogs.viewUserProducts(context, userBalance, rewards, pageNumber);

// 		await expect(attach.sendUserProductsCarrousel).toBeCalledWith(context, userBalance.balance, rewards, pageNumber);
// 		await expect(sendMainMenu).toBeCalledWith(context, null, 1000 * 3);
// 	});
// });
