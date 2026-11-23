-- Removes the Graceville Church demo and its sign-ins. Your own churches are not touched.
delete from churches where slug = 'graceville';
delete from auth.identities where user_id in (select id from auth.users where email like '%@graceville.example');
delete from auth.users where email like '%@graceville.example';
