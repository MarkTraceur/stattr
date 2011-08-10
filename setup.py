#!/usr/bin/python

from distutils.core import setup

setup(name='stattr',
      version='0.13',
      description='A web application for tracking competitive activities',
      author='Mark Holmquist',
      author_email='marktraceur@gmail.com',
      url='https://github.com/MarkTraceur/stattr',
      packages=['statserv'],
      package_dir={'statserv': 'statserv'},
      package_data={'statserv': ['stattrd.conf', 'tpls/*.tpl', 'static/*.html',
                                 'static/*.js', 'static/*.css']},
      scripts=['stattrd']
)
