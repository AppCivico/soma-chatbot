const assistenteAPI = require('./chatbot_api');
const { createIssue } = require('./utils/send_issue');
const flow = require('./utils/flow');
const help = require('./utils/helper');
const dialogs = require('./utils/dialogs');
const attach = require('./utils/attach');
const DF = require('./utils/dialogFlow');
const { mockProduct } = require('./utils/product');

module.exports = async (context) => {
	try {
		await context.setState({ chatbotData: await assistenteAPI.getChatbotData(context.event.rawEvent.recipient.id) });
		await assistenteAPI.postRecipient(context.state.chatbotData.user_id, await help.buildRecipientObj(context));

		if (context.event.isPostback) {
			await context.setState({ lastPBpayload: context.event.postback.payload });
			if (context.state.lastPBpayload === 'greetings' || !context.state.dialog || context.state.dialog === '') {
				await context.setState({ dialog: 'greetings' });
			} else {
				await context.setState({ dialog: context.state.lastPBpayload });
			}
			await assistenteAPI.logFlowChange(context.session.user.id, context.state.chatbotData.user_id,
				context.event.postback.payload, context.event.postback.title);
		} else if (context.event.isQuickReply) {
			await context.setState({ lastQRpayload: context.event.quickReply.payload });
			await context.setState({ dialog: context.state.lastQRpayload });
			await assistenteAPI.logFlowChange(context.session.user.id, context.state.chatbotData.user_id,
				context.event.message.quick_reply.payload, context.event.message.quick_reply.payload);
		} else if (context.event.isText) {
			await context.setState({ whatWasTyped: context.event.message.text });
			await DF.dialogFlow(context);
		}

		switch (context.state.dialog) {
		case 'greetings':
			await context.setState({ userPoints: 1, userKilos: 40, cheapestProduct: 50 });
			await context.setState({ userProducts: mockProduct.sort((a, b) => a.points - b.points) });
			await context.sendImage(flow.avatarImage);
			await attach.sendMsgFromAssistente(context, 'greetings', [flow.greetings.text1]);
			await dialogs.sendMainMenu(context);
			break;
		case 'mainMenu':
			await dialogs.sendMainMenu(context);
			break;
		case 'myPoints':
			await dialogs.myPoints(context);
			break;
		case 'viewUserProducts':
			await dialogs.viewUserProducts(context);
			break;
		case 'viewAllProducts':
			await dialogs.viewAllProducts(context);
			break;
		case 'compartilhar':
			// await context.sendText(flow.share.txt1);
			// await attach.sendShare(context, flow.share.cardData);
			// await dialogs.sendMainMenu(context);
			break;
		case 'createIssueDirect':
			await createIssue(context);
			await dialogs.sendMainMenu(context);
			break;
		case 'notificationOn':
			await assistenteAPI.updateBlacklistMA(context.session.user.id, 1);
			await assistenteAPI.logNotification(context.session.user.id, context.state.chatbotData.user_id, 3);
			await context.sendText(flow.notifications.on);
			break;
		case 'notificationOff':
			await assistenteAPI.updateBlacklistMA(context.session.user.id, 0);
			await assistenteAPI.logNotification(context.session.user.id, context.state.chatbotData.user_id, 4);
			await context.sendText(flow.notifications.off);
			break;
		} // end switch case
	} catch (error) {
		const date = new Date();
		console.log(`Parece que aconteceu um erro as ${date.toLocaleTimeString('pt-BR')} de ${date.getDate()}/${date.getMonth() + 1} =>`);
		console.log(error);
		await context.sendText('Ops. Tive um erro interno. Tente novamente.'); // warning user

		await help.Sentry.configureScope(async (scope) => { // sending to sentry
			scope.setUser({ username: context.session.user.first_name });
			scope.setExtra('state', context.state);
			throw error;
		});
	} // catch
}; // handler function
