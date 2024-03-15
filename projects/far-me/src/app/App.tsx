import React from 'react';
import {
  View,
  Text
} from 'react-native';
import { foo } from '@nearme-study-session/foo';

export const App = () => {
  return (
    <View style={{
      margin: 100,
    }}>
      <Text style={{
        fontSize: 32
      }}>Hi, { foo() }</Text>
    </View>
  );
};

export default App;
