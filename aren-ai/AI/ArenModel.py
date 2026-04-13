import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import numpy as np
import tensorflow as tf

users = ['Juan', 'Daniel',  'Ana', 'Christian']

movies = [
    'Star Wars', 'The Dark Knight', 'Shrek',
    'The Incredibles', 'Bleu', 'Memento'
]

features = ['Action', 'Sci-Fi', 'Comedy', 'Cartoon', 'Drama']

num_users = len(users)
num_movies = len(movies)
num_feats = len(features)
num_recommendations = 2


users_movies = tf.constant([
                [4,  6,  8,  0, 0, 0],
                [0,  0, 10,  0, 8, 3],
                [0,  6,  0,  0, 3, 7],
                [10, 9,  0,  5, 0, 2]], dtype=tf.float32)

movies_feats = tf.constant([
                [1, 1, 0, 0, 1],
                [1, 1, 0, 0, 0],
                [0, 0, 1, 1, 0],
                [1, 0, 1, 1, 0],
                [0, 0, 0, 0, 1],
                [1, 0, 0, 0, 1]], dtype=tf.float32)

users_feats = tf.matmul(users_movies, movies_feats)
print("User Features Matrix:")
print(users_feats.numpy()) 