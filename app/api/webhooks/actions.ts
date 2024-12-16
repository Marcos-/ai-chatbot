'use server'

import { kv } from '@vercel/kv'
import { getUser } from '@/app/login/actions'
import { auth } from '@/auth'
import { stripe } from '@/lib/stripe'
//import { subscription, User, Session } from '@/lib/types'
import { fromUnixTime } from 'date-fns'
import { User } from '@/lib/types'

export async function updateSubscription({
    email,
    customer,
    period,
    plan,
}: {
    email: string,
    customer: string,
    period: string,
    plan: string
}) {
    console.log('Atualizando mensalidade: ', email)

    try {
        const user = await getUser(email as string)
        const newUser = {
            ...user,
            plan,
            period,
            stripeId: customer,
            startDate: new Date(),
            chargeDate: period === 'month' ? fromUnixTime(Date.now() / 1000 + 30 * 24 * 60 * 60) : period === 'anual' ? fromUnixTime(Date.now() / 1000 + 365 * 24 * 60 * 60) : null,
        }
        console.log('updating user', newUser)

        await kv.hmset(`user:${email}`, newUser)

    } catch(error: any) {
        console.log(error)
        throw new Error('Ocorreu um erro ao adicionar usuário ', error.message)
    }
}

export async function cancelStripeSubscriptions(stripeId: string, filterId?: string) {
    // filterId is the current id that will not be cancelled
    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: stripeId,
        })
            
        subscriptions.data.forEach(async (subscription) => {
            if (subscription.id !== filterId) {
                await stripe.subscriptions.cancel(subscription.id)
            }
        })
    } catch(error) {
        console.log(error)
    }
}

export async function removeSubscription(stripeId: string, email?: string) {                                                                                                                                
    let userEmail: string | undefined = email; // Declare como string | undefined                                                                                                                           
                                                                                                                                                                                                            
    if (!email) {                                                                                                                                                                                           
        const stripeUser = await stripe.customers.retrieve(stripeId);                                                                                                                                       
                                                                                                                                                                                                            
        // Verifique se o stripeUser é um Customer antes de acessar a propriedade email                                                                                                                     
        if ('email' in stripeUser && stripeUser.email) {                                                                                                                                                    
            userEmail = stripeUser.email; // userEmail agora é string                                                                                                                                       
        } else {                                                                                                                                                                                            
            throw new Error('Usuário não encontrado ou foi excluído.');                                                                                                                                     
        }                                                                                                                                                                                                   
    }                                                                                                                                                                                                       
                                                                                                                                                                                                            
    console.log('Cancelando mensalidade: ', userEmail);                                                                                                                                                     
                                                                                                                                                                                                            
    const subscription = {                                                                                                                                                                         
         email: userEmail || '', // Atribua uma string vazia se userEmail for undefined                                                                                                                      
         customer: stripeId,                                                                                                                                                                                 
         plan: 'free',                                                                                                                                                                                       
         period: 'month',                                                                                                                                                                                            
     };                                                                                                                                                                                       
                                                                                                                                                                                                            
    await cancelStripeSubscriptions(stripeId);                                                                                                                                                              
    await updateSubscription(subscription);                                                                                                                                                                 
}  