from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

# 既存のUserAdminを登録解除
admin.site.unregister(User)

# UserAdminを再登録
admin.site.register(User, UserAdmin)